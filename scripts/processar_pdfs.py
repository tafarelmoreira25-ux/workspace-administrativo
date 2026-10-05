"""Assina/carimba cópias de PDFs sem reconstruir páginas, texto ou imagens.

Instalação: pip install pymupdf pillow
Execução: python scripts/processar_pdfs.py --entrada modelos_originais
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import logging
import os
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

import pymupdf as fitz
from PIL import Image

LOG = logging.getLogger("processar_pdfs")
ROOT = Path(__file__).resolve().parent.parent
ANCHORS = {
    "assinatura": ("CONTRATADA", "ASSINATURA DO RESPONSÁVEL", "PLATINO SOLUÇÕES FINANCEIRAS LTDA", "PLATINO SOLUÇÕES FINANCEIRAS"),
    "carimbo": ("Carimbo e assinatura", "CNPJ nº 52.807.405/0001-30", "52.807.405/0001-30", "CNPJ"),
}


@dataclass(frozen=True)
class Asset:
    name: str
    png: bytes
    width: int
    height: int


@dataclass(frozen=True)
class Placement:
    name: str
    page: int
    rect: fitz.Rect
    anchor: str

    def as_dict(self) -> dict:
        return {"elemento": self.name, "pagina": self.page + 1,
                "retangulo": list(self.rect), "ancora": self.anchor}


def sha256(path: Path, limit: int | None = None) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while limit is None or limit > 0:
            chunk = stream.read(min(limit, 1024 * 1024) if limit is not None else 1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
            if limit is not None:
                limit -= len(chunk)
    return digest.hexdigest()


def load_asset(name: str, path: Path, remove_white: bool = True) -> Asset:
    """Preserva dimensões e RGB; só torna o fundo branco neutro transparente.

    Não há redimensionamento, rotação, recoloração nem compressão com perdas.
    A versão preparada existe em memória; o PNG recebido permanece intocado.
    """
    with Image.open(path) as source:
        if source.format != "PNG":
            raise ValueError(f"{path}: a imagem precisa ser PNG.")
        rgba = source.convert("RGBA")
        if remove_white:
            pixels = rgba.get_flattened_data() if hasattr(rgba, "get_flattened_data") else rgba.getdata()
            rgba.putdata([(r, g, b, 0 if min(r, g, b) >= 235 and max(r, g, b) - min(r, g, b) <= 20 else a)
                          for r, g, b, a in pixels])
        if rgba.getchannel("A").getextrema() == (255, 255):
            raise ValueError(f"{path}: a imagem não possui fundo transparente.")
        if rgba.getchannel("A").getextrema() == (0, 0):
            raise ValueError(f"{path}: a imagem está completamente transparente.")
        stream = io.BytesIO()
        metadata = {key: source.info[key] for key in ("icc_profile", "dpi") if key in source.info}
        rgba.save(stream, format="PNG", **metadata)
        LOG.info("Imagem %s: %sx%s, transparência verificada", name, rgba.width, rgba.height)
        return Asset(name, stream.getvalue(), rgba.width, rgba.height)


def page_bounds(page: fitz.Page) -> fitz.Rect:
    # search_for / insert_image usam coordenadas da página sem rotação.
    return page.rect * page.derotation_matrix


def text_rectangles(page: fitz.Page) -> list[fitz.Rect]:
    result = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                if span["text"].strip(" _\t\n"):
                    result.append(fitz.Rect(span["bbox"]))
    return result


def occupied(page: fitz.Page) -> list[fitz.Rect]:
    # Inclui imagens já presentes para não duplicar assinaturas/carimbos.
    return text_rectangles(page) + [fitz.Rect(image["bbox"]) for image in page.get_image_info()]


def fit_rect(box: fitz.Rect, asset: Asset) -> fitz.Rect:
    """Encaixa sem deformar: a caixa efetiva mantém a proporção do PNG."""
    scale = min(box.width / asset.width, box.height / asset.height)
    width, height = asset.width * scale, asset.height * scale
    return fitz.Rect(box.x0 + (box.width - width) / 2, box.y0 + (box.height - height) / 2,
                     box.x0 + (box.width + width) / 2, box.y0 + (box.height + height) / 2)


def clear_rect(rect: fitz.Rect, bounds: fitz.Rect, obstacles: list[fitz.Rect]) -> bool:
    return not rect.is_empty and bounds.contains(rect) and not any(rect.intersects(other) for other in obstacles)


def find_anchor(document: fitz.Document, name: str, near: Placement | None = None):
    """Prefere rótulos curtos de assinatura; ignora menções no corpo do contrato."""
    for keyword in ANCHORS[name]:
        matches = []
        for index, page in enumerate(document):
            bounds = page_bounds(page)
            spans = text_rectangles(page)
            for rect in page.search_for(keyword):
                # Um CNPJ no topo ou CONTRATADA numa cláusula não é um campo de assinatura.
                if keyword in ("CONTRATADA", "CNPJ"):
                    if any(span.intersects(rect) and span.width > bounds.width * .6 for span in spans):
                        continue
                if near is not None and index != near.page:
                    continue
                if rect.y0 < bounds.y0 + bounds.height * .4:
                    continue
                distance = abs(rect.y0 - near.rect.y1) if near else -rect.y0
                matches.append((index, distance, rect))
        if matches:
            if near is None:
                index, _, rect = sorted(matches, key=lambda item: (item[0], -item[1]))[-1]
            else:
                index, _, rect = min(matches, key=lambda item: item[1])
            return index, rect, keyword
    return None


def locate(document: fitz.Document, asset: Asset, width: float,
           prior: list[Placement], manual: dict | None = None) -> Placement:
    if manual:
        index = int(manual["pagina"]) - 1
        if not 0 <= index < len(document):
            raise ValueError("Página inválida no arquivo de posições.")
        box = fitz.Rect(manual["retangulo"])
        if box.is_empty or box.is_infinite:
            raise ValueError("Retângulo inválido no arquivo de posições.")
        rect = fit_rect(box, asset)
        anchor_name = "posição explícita"
        candidates = [rect]
    else:
        near = prior[0] if asset.name == "carimbo" and prior else None
        found = find_anchor(document, asset.name, near)
        if found:
            index, anchor, anchor_name = found
            center = (anchor.x0 + anchor.x1) / 2
            height = width * asset.height / asset.width
            # Assinatura acima do rótulo; carimbo abaixo do bloco do emitente.
            top = anchor.y0 - height - 6 if asset.name == "assinatura" else anchor.y1 + 8
            candidates = [fitz.Rect(center - width / 2, top, center + width / 2, top + height)]
            # Se o campo estiver ocupado, examina espaços laterais próximos à mesma âncora.
            for left in (anchor.x1 + 12, anchor.x0 - width - 12):
                candidates.append(fitz.Rect(left, anchor.y0, left + width, anchor.y0 + height))
        else:
            index = len(document) - 1
            bounds = page_bounds(document[index])
            height = width * asset.height / asset.width
            top = bounds.y0 + bounds.height * (.72 if asset.name == "assinatura" else .86)
            right = bounds.x1 - bounds.width * .06
            candidates = [fitz.Rect(right - width, top, right, top + height)]
            anchor_name = "fallback relativo: canto inferior direito"
            LOG.warning("%s: âncora não encontrada; usando fallback relativo na página %s", asset.name, index + 1)
    page = document[index]
    obstacles = occupied(page) + [p.rect for p in prior if p.page == index]
    for rect in candidates:
        if clear_rect(rect, page_bounds(page), obstacles):
            return Placement(asset.name, index, rect, anchor_name)
    raise ValueError(f"{asset.name}: área ocupada ou fora da página {index + 1}; informe um retângulo livre com --posicoes.")


def snapshot(document: fitz.Document) -> list[dict]:
    return [{"text": page.get_text("words"), "mediabox": list(page.mediabox),
             "cropbox": list(page.cropbox), "rotation": page.rotation} for page in document]


def process_pdf(source: Path, destination: Path, assets: list[Asset], widths: dict,
                positions: dict | None = None) -> dict:
    """Copia, analisa, insere overlays e salva apenas uma revisão incremental."""
    LOG.info("Analisando: %s", source)
    if destination.exists():
        raise FileExistsError(f"Saída já existe; não foi sobrescrita: {destination}")
    digest = sha256(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".processando-", suffix=".pdf", dir=destination.parent)
    os.close(fd)
    working = Path(temporary)
    try:
        shutil.copy2(source, working)
        LOG.info("Duplicação realizada: %s -> %s", source, working)
        with fitz.open(working) as document:
            if not document.is_pdf or document.is_encrypted:
                raise ValueError("Arquivo inválido ou protegido por senha.")
            if not document.can_save_incrementally():
                raise ValueError("O PDF exige reparo; não pode ser salvo preservando a revisão original.")
            before = snapshot(document)
            # Confere que nenhum stream original (fontes, imagens, conteúdo) foi substituído.
            streams = {xref: hashlib.sha256(document.xref_stream_raw(xref)).hexdigest()
                       for xref in range(1, document.xref_length()) if document.xref_is_stream(xref)}
            placements = []
            for asset in assets:
                placement = locate(document, asset, widths[asset.name], placements, (positions or {}).get(asset.name))
                placements.append(placement)
                LOG.info("%s: página %s, bbox=%s, âncora=%s", asset.name, placement.page + 1,
                         [round(n, 2) for n in placement.rect], placement.anchor)
            for asset, placement in zip(assets, placements):
                document[placement.page].insert_image(placement.rect, stream=asset.png,
                                                      overlay=True, keep_proportion=True)
            document.saveIncr()
        with fitz.open(working) as checked:
            if snapshot(checked) != before:
                raise ValueError("A validação encontrou alteração de texto ou geometria da página.")
            for xref, original_hash in streams.items():
                if hashlib.sha256(checked.xref_stream_raw(xref)).hexdigest() != original_hash:
                    raise ValueError(f"Um stream original foi alterado: {xref}.")
        if sha256(source) != digest or sha256(working, source.stat().st_size) != digest:
            raise ValueError("A cópia não preserva integralmente os bytes originais.")
        # O arquivo final só aparece depois de todas as verificações.
        if destination.exists():
            raise FileExistsError(f"Saída criada por outro processo: {destination}")
        # Rename em Windows não sobrescreve; em outros sistemas link oferece criação exclusiva.
        if os.name == "nt":
            working.rename(destination)
        else:
            os.link(working, destination)
            working.unlink()
        LOG.info("Salvo e validado: %s (%s páginas)", destination, len(before))
        return {"entrada": str(source), "saida": str(destination), "sha256_original": digest,
                "paginas": len(before), "status": "ok", "posicoes": [p.as_dict() for p in placements]}
    finally:
        working.unlink(missing_ok=True)


def main(argv=None) -> int:
    # Saída legível também quando o terminal Windows captura logs por pipe.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure") and not stream.isatty():
            stream.reconfigure(encoding="utf-8", errors="backslashreplace")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--entrada", type=Path, default=ROOT / "modelos_originais")
    parser.add_argument("--saida", type=Path, default=ROOT / "documentos_processados")
    parser.add_argument("--assinatura", type=Path, default=ROOT / "assets/assinatura.png")
    parser.add_argument("--carimbo", type=Path, default=ROOT / "assets/carimbo.png")
    parser.add_argument("--largura-assinatura", type=float, default=92, help="Largura em pontos PDF (72 pontos = 1 polegada)")
    parser.add_argument("--largura-carimbo", type=float, default=85)
    parser.add_argument("--posicoes", type=Path, help="JSON por nome relativo: {arquivo.pdf: {assinatura: {pagina: 1, retangulo: [x0,y0,x1,y1]}}}")
    parser.add_argument("--manter-branco", action="store_true", help="Preserva também as áreas brancas opacas dos PNGs")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s", stream=sys.stdout)
    try:
        incoming, outgoing = args.entrada.resolve(strict=True), args.saida.resolve()
        if not incoming.is_dir() or incoming == outgoing or outgoing.is_relative_to(incoming) or incoming.is_relative_to(outgoing):
            raise ValueError("Use pastas de entrada e saída separadas, sem sobreposição.")
        if args.largura_assinatura <= 0 or args.largura_carimbo <= 0:
            raise ValueError("As larguras precisam ser positivas.")
        files = sorted(path for path in incoming.rglob("*") if path.is_file() and path.suffix.lower() == ".pdf")
        if not files:
            raise ValueError(f"Nenhum PDF encontrado em {incoming}. DOCX não é um PDF original.")
        assets = [load_asset("assinatura", args.assinatura, not args.manter_branco),
                  load_asset("carimbo", args.carimbo, not args.manter_branco)]
        positions = json.loads(args.posicoes.read_text(encoding="utf-8")) if args.posicoes else {}
        widths = {"assinatura": args.largura_assinatura, "carimbo": args.largura_carimbo}
        report = []
        for source in files:
            try:
                if not source.resolve().is_relative_to(incoming):
                    raise ValueError("O arquivo aponta para fora da pasta de entrada.")
                relative = source.relative_to(incoming)
                report.append(process_pdf(source, outgoing / relative, assets, widths, positions.get(relative.as_posix())))
            except Exception as error:
                LOG.error("Falha em %s: %s", source, error)
                report.append({"entrada": str(source), "status": "erro", "erro": str(error)})
        outgoing.mkdir(parents=True, exist_ok=True)
        report_file = outgoing / "relatorio-processamento.json"
        report_file.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        failures = sum(item["status"] == "erro" for item in report)
        LOG.info("Lote concluído: %s sucesso(s), %s falha(s). Relatório: %s", len(report) - failures, failures, report_file)
        return 1 if failures else 0
    except (OSError, ValueError) as error:
        LOG.error("%s", error)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
