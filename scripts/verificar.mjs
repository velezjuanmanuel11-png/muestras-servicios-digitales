import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const allowed = new Set([
  'README.md', 'OPERACION.md', '.gitignore',
  '.github/ISSUE_TEMPLATE/solicitud.yml', '.github/ISSUE_TEMPLATE/config.yml',
  '.github/workflows/verificar.yml', 'scripts/verificar.mjs',
  'muestras/correccion_texto_demo.md', 'muestras/catalogo_casa_cacao_demo.md',
  'muestras/casa_cacao_demo_vertical_8s.mp4'
]);
const found = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, {withFileTypes:true})) {
    if (item.name === '.git') continue;
    const abs = path.join(dir, item.name);
    assert(!item.isSymbolicLink(), 'No incluir enlaces simbólicos');
    if (item.isDirectory()) walk(abs);
    else found.push(path.relative(root, abs).split(path.sep).join('/'));
  }
}
walk(root);
for (const name of found) assert(allowed.has(name), 'Archivo fuera de la selección pública: ' + name);
for (const name of allowed) assert(found.includes(name), 'Falta archivo: ' + name);
for (const name of found.filter(n => n.endsWith('.md') || n.endsWith('.yml'))) {
  const body = fs.readFileSync(path.join(root,name),'utf8');
  assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(body), 'Revisar dirección de correo en: ' + name);
  assert(!/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN.*PRIVATE KEY-----/.test(body), 'Posible credencial en: ' + name);
  if (name.endsWith('.md')) {
    for (const match of body.matchAll(/\]\(([^)]+)\)/g)) {
      const href = match[1];
      if (/^https:\/\//.test(href) || href.startsWith('#')) continue;
      assert(!href.includes('..'), 'Enlace fuera del portafolio: ' + href);
      assert(fs.existsSync(path.resolve(root, path.dirname(name), href)), 'Enlace local inexistente: ' + href);
    }
  }
}
for (const name of ['muestras/correccion_texto_demo.md','muestras/catalogo_casa_cacao_demo.md']) {
  assert(/fictici[oa]/i.test(fs.readFileSync(path.join(root,name),'utf8')), 'La muestra debe estar marcada como ficticia');
}
const demo = fs.readFileSync(path.join(root,'muestras/casa_cacao_demo_vertical_8s.mp4'));
assert.equal(crypto.createHash('sha256').update(demo).digest('hex'),'9f4685c6ad10e74f07cc774b7e8a6ddc692cc96ada9865295a55151f78919626','La demo cambió: revisar y actualizar su firma');
const form = fs.readFileSync(path.join(root,'.github/ISSUE_TEMPLATE/solicitud.yml'),'utf8');
assert.equal((form.match(/^    id:/gm) || []).length, 5, 'El formulario debe tener cinco campos');
assert.equal((form.match(/required: true/g) || []).length, 4, 'Deben ser cuatro campos obligatorios');
assert(/consulta es pública/.test(form) && /cuenta de GitHub/.test(form), 'Falta informar el acceso y visibilidad');
const workflow = fs.readFileSync(path.join(root,'.github/workflows/verificar.yml'),'utf8');
assert(!/\bschedule:|\bcron:|pull_request_target:|issues:\s*write|contents:\s*write/.test(workflow),'No ampliar automatizaciones o permisos');
assert(/private == false/.test(workflow), 'Evitar ejecución con cargo en repositorio privado');
console.log('OK: ' + found.length + ' archivos públicos; enlaces, formulario y demo revisados.');
