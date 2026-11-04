// Reçoit un diagnostic du site et le poste dans le salon #configs du Discord ADMSTUDIOS.
// L'URL du webhook n'est jamais dans le site : elle est rangée dans la variable
// d'environnement DISCORD_WEBHOOK_URL, réglée dans Netlify.

const LABELS = {
  pc: { fixe: 'PC fixe', portable: 'PC portable' },
  gpu: { 1: 'Entrée de gamme', 2: 'Milieu de gamme', 3: 'Haut de gamme' },
  cpu: { 1: 'Ancien ou 4 cœurs', 2: 'Milieu', 3: 'Récent' },
  ram: { 8: '8 Go', 16: '16 Go', 32: '32 Go ou plus' },
  disk: { ssd: 'SSD', hdd: 'Disque dur (HDD)', nsp: 'Ne sait pas' },
  goal: { fps: 'Max FPS', equilibre: 'Équilibré', beau: 'Beau rendu' },
  pb: {
    fps: 'FPS bas', saccades: 'Saccades', crash: 'Crashs',
    textures: 'Textures qui chargent mal', chauffe: 'Chauffe', lag: 'Input lag',
  },
  bottleneck: {
    temp: 'La chauffe', ram: 'La RAM', disk: 'Le disque dur',
    cpu: 'Le processeur', gpu: 'La carte graphique', aucun: 'Rien de flagrant',
  },
  actions: {
    'gpu-laptop': 'Forcer la vraie carte graphique', ram8: 'Passer à 16 Go de RAM',
    ssd: 'Mettre GTA sur un SSD', 'ram-xmp': 'Débrider la RAM (XMP)',
    temps: 'Arrêter la surchauffe', gta: 'Couper les 3 réglages GTA',
    hz: 'Vérifier les Hz de l\'écran', cache: 'Vider le cache FiveM',
    textures: 'Budget de textures', drivers: 'Mettre à jour le pilote',
    lag: "Supprimer l'input lag", shaders: 'Cache des shaders illimité',
    cap: 'Bloquer les FPS', overlays: 'Couper les overlays',
    power: 'Mode performances', mods: 'Retirer les mods lourds',
    files: 'Réparer les fichiers de GTA',
  },
};

const STATUS = {
  nouveau: { title: 'Nouvelle config', color: 0x9b6bff },
  resolu: { title: 'Résolu', color: 0x5cc98a },
  'non-resolu': { title: 'Non résolu · ticket à venir', color: 0xfb7185 },
};

const bad = (msg) => new Response(msg, { status: 400 });
const known = (obj, v) => typeof v === 'string' && Object.hasOwn(obj, v);

export default async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 });

  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return new Response('Webhook non configuré', { status: 500 });

  let body;
  try {
    body = await req.json();
  } catch {
    return bad('JSON invalide');
  }

  // On n'accepte que des valeurs connues : personne ne peut écrire n'importe quoi dans le Discord.
  const { code, status, answers: a, bottleneck, done = [] } = body || {};
  if (!a || typeof a !== 'object') return bad('Réponses manquantes');
  if (typeof code !== 'string' || !/^ADM-[A-Z0-9]{5}$/.test(code)) return bad('Code invalide');
  if (!known(STATUS, status)) return bad('Statut invalide');
  for (const k of ['pc', 'gpu', 'cpu', 'ram', 'disk', 'goal']) {
    if (!known(LABELS[k], a[k])) return bad(`Réponse invalide : ${k}`);
  }
  if (!Array.isArray(a.pb) || a.pb.length > 6 || !a.pb.every((p) => known(LABELS.pb, p))) return bad('Problèmes invalides');
  if (!known(LABELS.bottleneck, bottleneck)) return bad('Goulot invalide');
  let message = '';
  if (body.message !== undefined) {
    if (typeof body.message !== 'string') return bad('Message invalide');
    // Texte libre du joueur : on retire les caractères invisibles et on coupe à 500 caractères.
    message = body.message.replace(/[\u0000-\u0009\u000B-\u001F\u007F\u200B-\u200F\u2028-\u202E]/g, '').trim().slice(0, 500);
  }
  if (!Array.isArray(done) || done.length > 20 || !done.every((d) => known(LABELS.actions, d))) return bad('Étapes invalides');

  const fields = [
    { name: 'PC', value: LABELS.pc[a.pc], inline: true },
    { name: 'Carte graphique', value: LABELS.gpu[a.gpu], inline: true },
    { name: 'Processeur', value: LABELS.cpu[a.cpu], inline: true },
    { name: 'RAM', value: LABELS.ram[a.ram], inline: true },
    { name: 'Stockage', value: LABELS.disk[a.disk], inline: true },
    { name: 'Objectif', value: LABELS.goal[a.goal], inline: true },
    { name: 'Problèmes', value: a.pb.length ? a.pb.map((p) => LABELS.pb[p]).join(', ') : 'Aucun coché' },
    { name: 'Goulot détecté', value: LABELS.bottleneck[bottleneck] },
  ];
  if (status !== 'nouveau') {
    fields.push({
      name: `Déjà essayé (${done.length})`,
      value: done.length ? done.map((d) => `• ${LABELS.actions[d]}`).join('\n') : 'Rien coché comme fait',
    });
  }

  if (message) fields.unshift({ name: '❗ Ce qui ne va toujours pas', value: message });

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: "ADMSTUDIOS",
      allowed_mentions: { parse: [] },
      embeds: [{
        title: `${code} · ${STATUS[status].title}`,
        color: STATUS[status].color,
        fields,
        timestamp: new Date().toISOString(),
      }],
    }),
  });

  if (!res.ok) return new Response('Envoi vers Discord impossible', { status: 502 });
  return Response.json({ ok: true });
};
