import { cabeceraCookie } from '../../../lib/acceso.js';
export function POST() {
  return new Response(null, { status: 303, headers: { Location: '/admin/entrar', 'Set-Cookie': cabeceraCookie('', true) } });
}
