export const GOOGLE_DRIVE_CLIENTES_ROOT_FOLDER_ID =
  "1uP4IVec5rAeda_OzQRQTpBXuVsw6aNLy";

export const GOOGLE_DRIVE_CLIENTES_ATIVOS_FOLDER_ID =
  "1y2DtlTHz8LipsbzzJCLVmhrS30TWsOw7";

export const GOOGLE_DRIVE_CLIENTES_ROOT_URL =
  `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_CLIENTES_ROOT_FOLDER_ID}`;

export function normalizarNomeClienteDrive(nomePasta = "") {
  return String(nomePasta)
    .replace(/^\s*\d{4}\s*[-–—]\s*/u, "")
    .replace(/^\s*[._-]+\s*/u, "")
    .replace(/\s*[-–—]\s*ATIV[OA]\s*$/iu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function linkPastaGoogleDrive(folderId) {
  return folderId
    ? `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`
    : "";
}
