"""Verificação de preservação e posicionamento: python -m unittest discover -s scripts -p test_processar_pdfs.py"""
import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path

import pymupdf as fitz
from PIL import Image

from processar_pdfs import load_asset, locate, main, process_pdf, sha256


class ProcessPdfTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        for name in ("assinatura", "carimbo"):
            image = Image.new("RGBA", (200, 100), (255, 255, 255, 255))
            for x in range(40, 160):
                for y in range(30, 70):
                    image.putpixel((x, y), (0, 40, 210, 255))
            image.save(self.root / (name + ".png"))
        self.assets = [load_asset(name, self.root / (name + ".png")) for name in ("assinatura", "carimbo")]
        self.widths = {"assinatura": 92, "carimbo": 85}

    def tearDown(self):
        self.temporary.cleanup()

    def fixture(self, landscape=False, rotation=0):
        source = self.root / "original.pdf"
        with fitz.open() as document:
            page = document.new_page(width=842 if landscape else 595, height=595 if landscape else 842)
            page.insert_text((40, 70), "Clausula original: fontes e vetores preservados.")
            page.draw_rect(fitz.Rect(40, 90, 220, 130), color=(0, .3, 1), fill=(.8, .9, 1))
            photo = self.root / "foto.jpg"
            Image.new("RGB", (50, 30), "red").save(photo)
            page.insert_image(fitz.Rect(250, 80, 300, 110), filename=str(photo))
            page.insert_text((280, page.rect.height * .67), "CONTRATADA", fontsize=10)
            page.insert_text((280, page.rect.height * .67 + 16), "PLATINO SOLUÇÕES FINANCEIRAS LTDA", fontsize=9)
            page.insert_text((280, page.rect.height * .67 + 30), "CNPJ nº 52.807.405/0001-30", fontsize=9)
            page.set_rotation(rotation)
            document.save(source)
        return source

    def test_preserves_original_streams_and_pages_without_rasterizing(self):
        for landscape, rotation in ((False, 0), (True, 0), (False, 90)):
            with self.subTest(landscape=landscape, rotation=rotation):
                source = self.fixture(landscape, rotation)
                original_hash = sha256(source)
                destination = self.root / f"resultado-{landscape}-{rotation}.pdf"
                result = process_pdf(source, destination, self.assets, self.widths)
                self.assertEqual(original_hash, sha256(source))
                self.assertEqual(original_hash, sha256(destination, source.stat().st_size))
                self.assertEqual(result["paginas"], 1)
                with fitz.open(source) as original, fitz.open(destination) as processed:
                    self.assertEqual(original[0].get_text("words"), processed[0].get_text("words"))
                    self.assertEqual(len(processed[0].get_image_info()), 3)
                    for xref in range(1, original.xref_length()):
                        if original.xref_is_stream(xref):
                            self.assertEqual(hashlib.sha256(original.xref_stream_raw(xref)).digest(),
                                             hashlib.sha256(processed.xref_stream_raw(xref)).digest())
                for position in result["posicoes"]:
                    rect = fitz.Rect(position["retangulo"])
                    self.assertAlmostEqual(rect.width / rect.height, 2)

    def test_transparency_preserves_blue_pixels_and_resolution(self):
        import io
        with Image.open(io.BytesIO(self.assets[1].png)) as image:
            self.assertEqual(image.size, (200, 100))
            self.assertEqual(image.getpixel((0, 0)), (255, 255, 255, 0))
            self.assertEqual(image.getpixel((60, 40)), (0, 40, 210, 255))

    def test_does_not_overwrite_outputs_or_apply_second_overlay(self):
        source = self.fixture()
        destination = self.root / "resultado.pdf"
        process_pdf(source, destination, self.assets, self.widths)
        before = destination.read_bytes()
        with self.assertRaises(FileExistsError):
            process_pdf(source, destination, self.assets, self.widths)
        self.assertEqual(destination.read_bytes(), before)

    def test_fallback_is_on_last_page_and_respects_rotation(self):
        with fitz.open() as document:
            document.new_page()
            page = document.new_page(width=842, height=595)
            page.set_rotation(90)
            placement = locate(document, self.assets[0], 92, [])
            self.assertEqual(placement.page, 1)
            self.assertIn("fallback", placement.anchor)
            self.assertGreater(placement.rect.x0, 690)

    def test_collision_and_explicit_positions(self):
        source = self.fixture()
        with fitz.open(source) as document:
            manual = {"pagina": 1, "retangulo": [40, 55, 250, 80]}
            with self.assertRaisesRegex(ValueError, "área ocupada"):
                locate(document, self.assets[0], 92, [], manual)
            clear = {"pagina": 1, "retangulo": [40, 300, 180, 400]}
            placement = locate(document, self.assets[0], 92, [], clear)
            self.assertEqual(placement.anchor, "posição explícita")

    def test_batch_preserves_categories_and_reports_every_file(self):
        incoming, outgoing = self.root / "entrada", self.root / "saida"
        for name, landscape in (("DISTRATOS/a.pdf", False), ("RECIBOS/b.PDF", True)):
            destination = incoming / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(self.fixture(landscape), destination)
        arguments = ["--entrada", str(incoming), "--saida", str(outgoing),
                     "--assinatura", str(self.root / "assinatura.png"), "--carimbo", str(self.root / "carimbo.png")]
        self.assertEqual(main(arguments), 0)
        report = json.loads((outgoing / "relatorio-processamento.json").read_text(encoding="utf-8"))
        self.assertEqual([item["status"] for item in report], ["ok", "ok"])
        self.assertTrue((outgoing / "DISTRATOS/a.pdf").exists())
        self.assertTrue((outgoing / "RECIBOS/b.PDF").exists())
        hashes = {file: sha256(file) for file in outgoing.rglob("*") if file.suffix.lower() == ".pdf"}
        self.assertEqual(main(arguments), 1)
        self.assertEqual(hashes, {file: sha256(file) for file in hashes})


if __name__ == "__main__":
    unittest.main()
