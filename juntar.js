import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = __dirname;
const outputFilePath = path.join(rootDir, 'PROJETO_COMPLETO_NOTEBOOK_LM.txt');

// Folders to read recursively
const foldersToRead = ['src', 'api', 'scripts'];
// Specific files in root to read
const rootFilesToRead = ['index.html', 'package.json'];

// Binary extensions to skip
const binaryExtensions = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz',
  '.mp4', '.mp3', '.wav', '.woff', '.woff2', '.ttf', '.eot', '.map'
]);

let totalFilesJoined = 0;
let outputContent = '';

function isBinaryFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return binaryExtensions.has(ext);
}

function traverseDirectory(dirPath) {
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    // Skip hidden files/directories (starting with .) and node_modules
    if (item.startsWith('.') || item === 'node_modules') {
      continue;
    }

    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      traverseDirectory(fullPath);
    } else if (stat.isFile()) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  if (isBinaryFile(filePath)) {
    console.log(`Pular (binário): ${path.relative(rootDir, filePath)}`);
    return;
  }

  try {
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf8');
    
    outputContent += `\n================================================================================\n`;
    outputContent += `FILE: ${relativePath}\n`;
    outputContent += `================================================================================\n`;
    outputContent += content;
    outputContent += `\n`;
    
    totalFilesJoined++;
    console.log(`Adicionado: ${relativePath}`);
  } catch (err) {
    console.error(`Erro ao ler o arquivo ${filePath}:`, err.message);
  }
}

function main() {
  console.log('Iniciando concatenação do projeto...');

  // 1. Process specific root files
  for (const file of rootFilesToRead) {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      processFile(filePath);
    } else {
      console.warn(`Arquivo do root não encontrado: ${file}`);
    }
  }

  // 2. Process specified folders recursively
  for (const folder of foldersToRead) {
    const folderPath = path.join(rootDir, folder);
    if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
      traverseDirectory(folderPath);
    } else {
      console.warn(`Pasta não encontrada: ${folder}`);
    }
  }

  // 3. Write output file
  try {
    fs.writeFileSync(outputFilePath, outputContent, 'utf8');
    console.log(`\nSucesso! ${totalFilesJoined} arquivos foram concatenados em ${path.basename(outputFilePath)}`);
  } catch (err) {
    console.error('Erro ao escrever arquivo de saída:', err.message);
  }
}

main();
