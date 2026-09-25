import fs from 'fs';
import path from 'path';

const files = [
  'src/types/index.ts',
  'src/lib/calculations.ts',
  'src/lib/formatters.ts',
  'firestore.rules',
  'src/hooks/useGoals.ts',
  'src/hooks/useTransactions.ts',
  'api/webhook-apple-pay.ts'
];

let output = '# CasalPay — Código-Fonte Essencial & Modelos de Dados 💻📄\n\n';
output += 'Este documento reúne os arquivos estruturais, cálculos financeiros, regras de segurança e integração do CasalPay.\n\n';

for (const relPath of files) {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const ext = path.extname(relPath).replace('.', '') || 'text';
    output += `## 📄 Arquivo: \`${relPath}\`\n\n`;
    output += `\`\`\`${ext === 'rules' ? 'text' : ext}\n`;
    output += content.trim() + '\n';
    output += '```\n\n---\n\n';
  }
}

fs.writeFileSync('docs/notebooklm/04_CODIGO_FONTE_ESSENCIAL.md', output, 'utf8');
console.log('✅ Arquivo docs/notebooklm/04_CODIGO_FONTE_ESSENCIAL.md gerado com sucesso!');
