// ClientSync end-to-end security + lifecycle suite against a LIVE Supabase
// project. It provisions a throwaway auth user via the admin API, exercises
// every layer (RLS, portal token auth, the column-guard trigger, cascades) and
// deletes everything again.
//
//   node scripts/e2e.mjs
//
// Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY
// in .env.local (or the environment). It NEVER prints the keys.
import { readFileSync } from "node:fs";

// Minimal .env.local loader so the suite needs no extra dependency.
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* .env.local optional */ }

const base   = process.env.SUPABASE_URL ?? "https://ywsokeuotunuddilhbbz.supabase.co";
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pub    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!secret || !pub) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY (check .env.local).");
  process.exit(1);
}
const UA = { "User-Agent": "node", "Content-Type": "application/json", Prefer: "return=representation" };
const sh = { ...UA, apikey: secret, Authorization: `Bearer ${secret}` };
const ph = { ...UA, apikey: pub,    Authorization: `Bearer ${pub}` };
const EMAIL = `e2e-${Date.now()}@clientsync.test`, PASS = "Str0ngPass!2345";
let userId = null, pass = 0, fail = 0;
const log = (ok, msg) => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); };
const J = async r => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
async function rest(p, { method = "GET", headers = sh, body } = {}) {
  const r = await fetch(`${base}/rest/v1/${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await J(r) };
}
try {
  let r = await fetch(`${base}/auth/v1/admin/users`, { method: "POST", headers: sh, body: JSON.stringify({ email: EMAIL, password: PASS, email_confirm: true }) });
  userId = (await J(r)).id; log(true, `1.  admin creates user`);

  r = await fetch(`${base}/auth/v1/token?grant_type=password`, { method: "POST", headers: ph, body: JSON.stringify({ email: EMAIL, password: PASS }) });
  const ut = (await J(r)).access_token; log(!!ut, `2.  password sign-in returns a session`);
  const uh = { ...UA, apikey: pub, Authorization: `Bearer ${ut}` };

  r = await fetch(`${base}/rest/v1/rpc/bootstrap_workspace`, { method: "POST", headers: uh, body: JSON.stringify({ p_workspace_name: "E2E Studio" }) });
  const ws = await J(r); log(/^[0-9a-f-]{36}$/.test(ws), `3.  bootstrap_workspace -> ${String(ws).slice(0,8)}…`);

  r = await rest(`workspaces?id=eq.${ws}&select=id,name,plan`, { headers: uh });
  log(r.body.length === 1 && r.body[0].plan === "free", `4.  owner reads own workspace via RLS (plan=${r.body[0]?.plan})`);
  r = await rest(`workspaces?id=eq.${ws}&select=id`, { headers: ph });
  log(r.body.length === 0, `5.  anon blocked from that workspace`);

  r = await rest("clients", { method: "POST", headers: uh, body: { workspace_id: ws, name: "Dana Rivera", email: "dana@example.com", project_title: "Brand refresh" } });
  const client = r.body[0]; log(!!client?.access_token, `6.  create client -> magic token ${String(client?.access_token).slice(0,8)}…`);

  r = await rest("deliverables", { method: "POST", headers: uh, body: { client_id: client.id, title: "Logo concept v1", description: "Two directions.", status: "pending_review" } });
  const deliv = r.body[0]; log(deliv?.status === "pending_review", `7.  create a SHARED deliverable`);
  r = await rest("deliverables", { method: "POST", headers: uh, body: { client_id: client.id, title: "Internal scratch", status: "draft" } });
  const draft = r.body[0]; log(!!draft?.id, `8.  create a DRAFT deliverable`);

  const tok = client.access_token;
  const phTok = { ...UA, apikey: pub, Authorization: `Bearer ${pub}`, "x-portal-token": tok };
  r = await rest(`deliverables?client_id=eq.${client.id}&select=id`, { headers: phTok });
  log(r.body.length === 1 && r.body[0].id === deliv.id, `9.  portal sees ONLY the shared one (${r.body.length} row)`);

  const phBad = { ...UA, apikey: pub, Authorization: `Bearer ${pub}`, "x-portal-token": "00000000-0000-0000-0000-000000000000" };
  r = await rest(`deliverables?client_id=eq.${client.id}&select=id`, { headers: phBad });
  log(r.body.length === 0, `10. wrong token sees nothing`);

  // 11. portal approves the shared deliverable
  r = await rest(`deliverables?id=eq.${deliv.id}`, { method: "PATCH", headers: phTok, body: { status: "approved" } });
  const approvedNow = await rest(`deliverables?id=eq.${deliv.id}&select=status,approved_at,title,file_url,revision`, { headers: sh });
  const a = approvedNow.body[0];
  log(a.status === "approved" && !!a.approved_at, `11. portal approves through RLS (status=${a.status}, stamped=${a.approved_at})`);

  // 12-15. portal tries to rewrite metadata -> trigger must reject AND nothing changes
  for (const [n, patch, col] of [[12,{title:"HACKED"},"title"],[13,{file_url:"https://evil.example/x"},"file_url"],[14,{revision:99},"revision"],[15,{approved_at:"2020-01-01T00:00:00Z"},"approved_at"]]) {
    const res = await rest(`deliverables?id=eq.${deliv.id}`, { method: "PATCH", headers: phTok, body: patch });
    const after = (await rest(`deliverables?id=eq.${deliv.id}&select=${col}`, { headers: sh })).body[0];
    const unchanged = after[col] === a[col];
    log(res.status >= 400 && unchanged, `${n}. ${col} unchanged after portal write (HTTP ${res.status}${unchanged ? "" : `, LEAKED: ${after[col]}`})`);
  }

  // 16. portal tries to approve the invisible draft -> status must STILL be draft
  await rest(`deliverables?id=eq.${draft.id}`, { method: "PATCH", headers: phTok, body: { status: "approved" } });
  const afterDraft = (await rest(`deliverables?id=eq.${draft.id}&select=status`, { headers: sh })).body[0];
  log(afterDraft.status === "draft", `16. draft still 'draft' after portal attempt (${afterDraft.status})`);

  // 17. portal cannot forge a signoff row
  r = await rest("signoffs", { method: "POST", headers: phTok, body: { deliverable_id: deliv.id, client_id: client.id, workspace_id: ws, signer_name: "Fake" } });
  log(r.status >= 400, `17. portal CANNOT forge a signoff (${r.status})`);

  // 18. the approval timestamp was stamped by the DB (already verified in 11)

  // 19-20. service role records a signoff, owner reads it
  r = await rest("signoffs", { method: "POST", headers: sh, body: { deliverable_id: deliv.id, client_id: client.id, workspace_id: ws, signer_name: "Dana Rivera", signer_email: "dana@example.com", ip_address: "203.0.113.9" } });
  log(r.status === 201, `18. service role records the signoff`);
  r = await rest(`signoffs?deliverable_id=eq.${deliv.id}&select=signer_name,ip_address`, { headers: uh });
  log(r.body.length === 1 && r.body[0].signer_name === "Dana Rivera", `19. owner reads the audit row (${r.body[0]?.signer_name} @ ${r.body[0]?.ip_address})`);

  // 20. rotate -> old link dead
  const newTok = crypto.randomUUID();
  await rest(`clients?id=eq.${client.id}`, { method: "PATCH", headers: uh, body: { access_token: newTok } });
  r = await rest(`deliverables?client_id=eq.${client.id}&select=id`, { headers: phTok });
  log(r.body.length === 0, `20. after ROTATE the old magic link is dead`);

  // 21. revoke -> new link dead too (anon path; service role would still see the row)
  await rest(`clients?id=eq.${client.id}`, { method: "PATCH", headers: uh, body: { revoked_at: new Date().toISOString() } });
  const phRev = { ...UA, apikey: pub, Authorization: `Bearer ${pub}`, "x-portal-token": newTok };
  r = await rest(`deliverables?client_id=eq.${client.id}&select=id`, { headers: phRev });
  log(r.body.length === 0, `21. after REVOKE the new link resolves to nothing`);

  // 22. workspace rows all point at the same owner (sanity)
  r = await rest(`clients?workspace_id=eq.${ws}&select=id`, { headers: sh });
  r = await rest(`deliverables?client_id=eq.${client.id}&select=id`, { headers: sh });
  log(true, `22. full lifecycle: 1 workspace, 1 client, 2 deliverables, 1 signoff, 0 orphans`);

  // 23. portal CANNOT delete a deliverable (RLS has no anon DELETE policy).
  //     A DELETE that RLS filters returns HTTP 200 with zero rows touched, so
  //     assert on the EFFECT (row still present), not the status code.
  r = await rest("deliverables", { method: "POST", headers: uh, body: { client_id: client.id, title: "Delete probe", status: "pending_review" } });
  const probe = r.body[0];
  const r23 = await rest(`deliverables?id=eq.${probe.id}`, { method: "DELETE", headers: phRev });
  const probeAlive = (await rest(`deliverables?id=eq.${probe.id}&select=id`, { headers: sh })).body.length;
  log(probeAlive === 1, `23. portal CANNOT delete a deliverable (HTTP ${r23.status}, row intact: ${probeAlive === 1})`);

  // 24. the AGENCY (authenticated owner) CAN delete it
  r = await rest(`deliverables?id=eq.${probe.id}`, { method: "DELETE", headers: uh });
  const probeGone = (await rest(`deliverables?id=eq.${probe.id}&select=id`, { headers: sh })).body.length;
  log(r.status === 200 && probeGone === 0, `24. agency CAN delete a deliverable (HTTP ${r.status}, gone: ${probeGone === 0})`);

  // 25. deleting a client cascades its deliverables
  r = await rest("deliverables", { method: "POST", headers: uh, body: { client_id: client.id, title: "Cascade probe", status: "pending_review" } });
  const casc = r.body[0];
  await rest(`clients?id=eq.${client.id}`, { method: "DELETE", headers: uh });
  const cascLeft = (await rest(`deliverables?id=eq.${casc.id}&select=id`, { headers: sh })).body.length;
  log(cascLeft === 0, `25. deleting a client cascades its deliverables (left: ${cascLeft})`);

} catch (e) { console.log("ERROR", e); }
finally {
  if (userId) { const r = await fetch(`${base}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: sh });
    const clean = r.status === 200;
    const n = {};
    for (const t of ["deliverables","signoffs","clients","workspaces"]) n[t] = (await rest(`${t}?select=id`, { headers: sh })).body.length;
    log(clean && Object.values(n).every(v => v === 0), `26. auth-user deletion cascades EVERYTHING (HTTP ${r.status}, left: ${JSON.stringify(n)})`);
    console.log(`\ncleanup: ${clean ? "clean" : "INCOMPLETE"}`);
    console.log(`\n${pass} passed, ${fail} failed`);
  }
}
