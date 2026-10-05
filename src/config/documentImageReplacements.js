// Imagens empresariais identificadas visualmente; nunca substituir assinaturas de clientes.
export const DOCUMENT_IMAGE_REPLACEMENTS = {
  "85d61b22bc5686060e7e924f62d0d092b9a736e9733f77733f8332f9aeed945c": "assinatura",
  "6f9666d9c1049ed5f9572a6d2768b1349b2c33f5e6dc550f379be6e3fe2e050b": "assinatura",
  "d9e2b983cca1ba60a8a3265ea411444478b44dd301ae2fcc8a94419a0ef7bcb0": "assinatura",
  "a6a88e7ef317bda4ffa3b51cc153ce78ea2966eee445db20e427453163112984": "assinatura",
  "85e0a5d6a4c3939bdf7c2d8e4f0813316727ad3d51d07019a8822a144caa39cd": "assinatura",
  "fe4622599fad2de7ced713e8fc8dfcc8b8a782e637a6557b87cf4d65fd9d3280": "assinatura",
  "e9f68f8b865ef6173ef7e390e126004d8bf5a682075af575b0a1724ee34233c4": "carimbo",
  "cb40e8c38a7b3130e62af641478f6750aebc00e340e387a0e3de56397b822961": "carimbo",
  "e2921c3ee8458ae4df4ac1ab12f39e00eaa9901b3061f70a4adec285840fc677": "carimbo"
};

// Este PNG antigo contém assinatura e linha no mesmo bitmap (490 x 522).
// A caixa da tinta e a linha foram conferidas na imagem original, sem redesenhar a assinatura.
export const DOCUMENT_IMAGE_COMPOSITE = {
  "d9e2b983cca1ba60a8a3265ea411444478b44dd301ae2fcc8a94419a0ef7bcb0": {
    caixa: [165 / 490, 167 / 522, 355 / 490, 322 / 522], linha: [7 / 490, 308 / 522, 489 / 490],
  },
};
