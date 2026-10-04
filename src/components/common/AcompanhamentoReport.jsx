import { useState } from 'react';
import { montarRelatorioAcompanhamento, textoWhatsApp } from '../../lib/acompanhamentoReport';
import './acompanhamentoReport.css';

export default function AcompanhamentoReport({ texto, processo, cliente, timeline, esfera }) {
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const report = texto ?? montarRelatorioAcompanhamento({ processo, cliente, timeline, esfera });

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoWhatsApp(report));
      setFeedback('Relatório copiado para WhatsApp.');
    } catch { setFeedback('Não foi possível copiar. Selecione e copie o texto do relatório.'); }
  }

  async function pdf() {
    setBusy(true);
    try {
      const { PDFDocument, StandardFonts } = await import('pdf-lib');
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const safe = (text) => [...text].map((char) => { try { font.encodeText(char); return char; } catch { return '?'; } }).join('');
      let page, y;
      const newPage = () => { page = doc.addPage([595.28, 841.89]); y = 790; };
      newPage();
      for (const paragraph of report.split('\n')) {
        let line = '';
        const draw = () => { if (y < 50) newPage(); page.drawText(line, { x: 50, y, font, size: 11 }); y -= 17; };
        for (const word of safe(paragraph).split(/\s+/)) {
          for (const char of (line ? ' ' : '') + word) {
            if (font.widthOfTextAtSize(line + char, 11) > 495) { draw(); line = ''; }
            line += char;
          }
        }
        draw();
      }
      const url = URL.createObjectURL(new Blob([await doc.save()], { type: 'application/pdf' }));
      const link = document.createElement('a'); link.href = url; link.download = 'relatorio-acompanhamento.pdf'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setFeedback('PDF gerado.');
    } catch { setFeedback('Não foi possível gerar o PDF. Tente novamente.'); }
    finally { setBusy(false); }
  }

  function imprimir() {
    const popup = window.open('', '_blank', 'width=850,height=750');
    if (!popup) { setFeedback('Permita a abertura da janela de impressão no navegador.'); return; }
    popup.document.title = 'Relatório de acompanhamento';
    const style = popup.document.createElement('style');
    style.textContent = '@page{size:A4;margin:20mm}body{font:12pt Arial;color:#111}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.5}';
    popup.document.head.append(style);
    const content = popup.document.createElement('pre'); content.textContent = report; popup.document.body.append(content);
    popup.document.close(); popup.focus(); popup.print();
  }

  return <section className="acompanhamento-report"><div className="acompanhamento-report-toolbar"><h3>Relatório de acompanhamento</h3><div><button type="button" onClick={copiar}>Copiar para WhatsApp</button><button type="button" disabled={busy} onClick={pdf}>{busy ? 'Gerando PDF...' : 'Gerar PDF'}</button><button type="button" onClick={imprimir}>Imprimir</button></div></div>{feedback ? <p role="status">{feedback}</p> : null}<pre className="acompanhamento-report-preview">{report}</pre></section>;
}
