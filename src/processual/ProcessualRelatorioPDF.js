import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { AVISO_PROCESSUAL, FINALIDADE_PROCESSUAL } from "./processualConstants.js";

const A4 = [595.28, 841.89], M = 52, AZUL = rgb(15/255,42/255,85/255), CINZA = rgb(.35,.42,.52);
function nomeSeguro(valor) { return String(valor || "documento").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,""); }
function linhas(texto, fonte, tamanho, largura) { const saida=[]; for(const paragrafo of String(texto||"").split("\n")){ let atual=""; for(const palavra of paragrafo.split(/\s+/)){ const teste=atual?`${atual} ${palavra}`:palavra; if(fonte.widthOfTextAtSize(teste,tamanho)>largura&&atual){saida.push(atual);atual=palavra;}else atual=teste;} saida.push(atual||" "); } return saida; }

export async function gerarRelatorioProcessualPDF({ dados, codigo, anexos }) {
  const pdf=await PDFDocument.create(), normal=await pdf.embedFont(StandardFonts.Helvetica), bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  let page=pdf.addPage(A4), y=790;
  async function logo(){try{const b=await fetch("/assets/platino-icon.png").then(r=>r.arrayBuffer());const img=await pdf.embedPng(b);page.drawImage(img,{x:M,y:755,width:45,height:45});}catch{return;}}
  function nova(){page=pdf.addPage(A4);y=790;}
  function garantir(altura=45){if(y-altura<65)nova();}
  function texto(valor,{size=10,font=normal,color=AZUL,gap=15,indent=0}={}){const ls=linhas(valor,font,size,A4[0]-M*2-indent);garantir(ls.length*(size+4)+gap);for(const l of ls){page.drawText(l,{x:M+indent,y,size,font,color});y-=size+4;}y-=gap;}
  await logo(); page.drawText("PLATINO",{x:108,y:781,size:15,font:bold,color:AZUL}); page.drawText("RELATÓRIO DE ATUALIZAÇÃO PROCESSUAL",{x:M,y:720,size:18,font:bold,color:AZUL});
  y=690; texto(`Código: ${codigo}`,{font:bold,gap:4}); texto(`Data da consulta: ${dados.data_consulta||"Não informada"}`,{font:bold,gap:22});
  const local=[dados.tribunal,dados.vara,dados.forum_comarca,dados.cidade_estado].filter(Boolean).join(" – "); texto(local||"Tribunal não informado",{font:bold,size:12,gap:20});
  for(const [r,v] of [["Cliente (Autor)",dados.cliente_autor],["Instituição Financeira (Réu)",dados.instituicao_reu],["Número do Processo",dados.numero_processo],["Data de distribuição",dados.data_distribuicao],["Juiz responsável",dados.juiz_responsavel]]){texto(`${r}:`,{font:bold,gap:2});texto(v||"Não informado",{gap:10});}
  texto("ANDAMENTO PROCESSUAL",{font:bold,size:13,gap:16});
  for(const [r,v] of [["Status atual",dados.status_atual],["Última movimentação",dados.ultima_movimentacao],["Próximos passos",dados.proximos_passos]]){texto(`${r}:`,{font:bold,gap:4});texto(v||"Não informado",{gap:16});}
  if(dados.observacao_cliente){texto("Observação complementar ao cliente:",{font:bold,gap:4});texto(dados.observacao_cliente,{gap:18});}
  texto(`Responsável pela atualização: ${dados.responsavel||"Não informado"}`,{font:bold,gap:18}); texto(AVISO_PROCESSUAL,{size:8,color:CINZA,gap:10}); texto(FINALIDADE_PROCESSUAL,{size:8,font:bold,color:CINZA});

  const incluidos=[...anexos].filter(a=>a.incluir&&a.arquivo).sort((a,b)=>{
    const grupoA=a.arquivo.type==="application/pdf"?1:0, grupoB=b.arquivo.type==="application/pdf"?1:0;
    return grupoA-grupoB || a.ordem-b.ordem;
  });
  for(let i=0;i<incluidos.length;i++){const a=incluidos[i];nova();page.drawText(`ANEXO ${romano(i+1)}`,{x:M,y:680,size:24,font:bold,color:AZUL});page.drawText(a.tipo||"Outro",{x:M,y:640,size:15,font:bold,color:AZUL});textoNa(page,a.nome,600,bold,12);textoNa(page,a.descricao||"Documento anexado ao relatório processual.",570,normal,10);
    const bytes=await a.arquivo.arrayBuffer();
    if(a.arquivo.type==="application/pdf"){const origem=await PDFDocument.load(bytes);const copiadas=await pdf.copyPages(origem,origem.getPageIndices());copiadas.forEach(p=>pdf.addPage(p));}
    else {nova();const img=a.arquivo.type==="image/png"?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const escala=Math.min((A4[0]-M*2)/img.width,(A4[1]-M*2)/img.height);page.drawImage(img,{x:(A4[0]-img.width*escala)/2,y:(A4[1]-img.height*escala)/2,width:img.width*escala,height:img.height*escala});}
  }
  const total=pdf.getPageCount(); pdf.getPages().forEach((p,i)=>p.drawText(`Página ${i+1} de ${total}`,{x:490,y:26,size:8,font:normal,color:CINZA}));
  const bytes=await pdf.save(); return { blob:new Blob([bytes],{type:"application/pdf"}), nome:`${codigo}_${nomeSeguro(dados.cliente_autor)}_${nomeSeguro(dados.numero_processo)}.pdf` };
}
function textoNa(page,texto,y,font,size){linhas(texto,font,size,A4[0]-M*2).forEach((l,i)=>page.drawText(l,{x:M,y:y-i*(size+4),size,font,color:AZUL}));}
function romano(n){const mapa=[[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];let s="";for(const [v,l] of mapa)while(n>=v){s+=l;n-=v;}return s;}
export function baixarPDF({blob,nome}){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=nome;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
