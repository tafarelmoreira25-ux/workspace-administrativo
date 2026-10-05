# Processamento dos PDFs originais

Instale as dependências:

```powershell
pip install pymupdf pillow
```

Coloque os **PDFs originais** em `modelos_originais/`, mantendo as subpastas das categorias. As imagens recebidas estão em `assets/assinatura.png` e `assets/carimbo.png`; os arquivos fornecidos não são sobrescritos.

```powershell
python scripts/processar_pdfs.py --entrada modelos_originais --saida documentos_processados
```

É possível usar caminhos absolutos com `--entrada`, `--saida`, `--assinatura` e `--carimbo`. O script percorre todas as subpastas e mantém a organização. A saída registra as coordenadas e o resultado de cada documento em `relatorio-processamento.json`. Falhas individuais não interrompem a análise dos demais arquivos e o comando retorna código 1 se houver falhas. Arquivos de saída existentes não são sobrescritos.

A cópia recebe uma revisão incremental do PDF. Não há conversão de páginas em imagens, reflow de texto, troca de fontes ou recompressão dos streams existentes. O script verifica o SHA-256 do original, o prefixo integral de bytes da cópia, os streams originais, a quantidade de páginas, as caixas de página, a rotação e as palavras com suas coordenadas depois de salvar. A assinatura e o carimbo são PNGs sobrepostos com a proporção preservada. Essa sobreposição visual não constitui uma assinatura digital criptográfica.

A preparação em memória torna transparentes somente pixels de fundo branco neutro (canais RGB >= 235 e diferença entre canais <= 20). Mantém as dimensões, os canais de cor dos traços e a transparência existente; não gira nem redesenha as imagens. `--manter-branco` desativa esse tratamento, preservando inclusive o branco opaco. As cópias transparentes usadas pelo gerador web ficam em `public/assets/documentos/`.

O posicionamento automático procura rótulos de assinatura e identificação do emitente na parte inferior do documento. Sem uma âncora, usa a posição relativa na última página e registra um aviso. Verifica texto e imagens existentes para evitar sobreposição. Se o local estiver ocupado, não entrega uma cópia defeituosa: registre uma posição livre no JSON abaixo. PDFs que já contêm assinatura ou carimbo na área pretendida precisam de conferência; o script não apaga elementos do original.

Exemplo de `posicoes.json` (páginas começam em 1, coordenadas em pontos PDF, origem superior esquerda da página sem rotação):

```json
{
  "DISTRATOS/exemplo.pdf": {
    "assinatura": {"pagina": 2, "retangulo": [350, 500, 445, 585]},
    "carimbo": {"pagina": 2, "retangulo": [350, 620, 435, 690]}
  }
}
```

```powershell
python scripts/processar_pdfs.py --posicoes posicoes.json
python -m unittest discover -s scripts -p test_processar_pdfs.py
```

O script preserva um PDF-base correto; não corrige texto apertado, páginas extras ou imagens erradas já presentes na entrada. Os modelos do lote recebido são DOCX, por isso esse processamento exige seus PDFs originais. A correção das seções/colunas do gerador web é tratada no conversor existente, separadamente do script Python.

Referências das APIs: [inserção de imagens do PyMuPDF](https://pymupdf.readthedocs.io/en/latest/page.html#Page.insert_image) e [salvamento incremental](https://pymupdf.readthedocs.io/en/latest/document.html#Document.saveIncr).
