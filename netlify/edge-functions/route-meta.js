/* Per-route titles, descriptions and canonical URLs for the SPA.
   Crawlers never run JS, so /mcat and /dat cannot keep the homepage tags that
   ship in index.html. /practice keeps its clinical card. Unknown paths are
   real 404s: the SPA fallback still returns the app shell, and this function
   sets the status. Redirects (retired courses) pass through untouched. */

const ORIGIN = 'https://cortexmedical.academy';

const MCAT_DESCRIPTION =
  'Free, evidence-based MCAT prep: 260+ practice questions with answer breakdowns, 500+ spaced-repetition flashcards, original CARS & science passages, and timed practice with saved review. No account, no paywall — free forever.';

export const ROUTES = {
  mcat: {
    title: 'MCAT preparation | Cortex Medical Academy',
    description: MCAT_DESCRIPTION,
    path: '/mcat',
  },
  dat: {
    title: 'DAT preparation | Cortex Medical Academy',
    description:
      "Free preparation for the U.S. Dental Admission Test: timed biology, general chemistry and organic chemistry drills, all six perceptual-ability subtests with generated figures, timed reading-comprehension passages, and quantitative reasoning with the exam's on-screen calculator.",
    path: '/dat',
  },
  practice: {
    title: 'Clinical Scenarios — Cortex Medical Academy',
    description:
      "Start your shift: interview the patient, examine, order tests, decide — then chart your note and compare it against the clinician's. 2,599+ cases across 26 specialties, free.",
    path: '/practice',
    image: 'https://cortexmedical.academy/og-clinical.jpg',
    imageAlt: 'Clinical Scenarios — start your shift: interview, examine, decide, and chart. Free, no sign-up.',
  },
  academy: {
    title: 'Choose what you want to learn. | Cortex Medical Academy',
    description:
      'Find a study path at Cortex Medical Academy. MCAT and DAT preparation and clinical scenarios are open; other courses stay in review until they are ready.',
    path: '/academy',
  },
  updates: {
    title: 'Updates. | Cortex Medical Academy',
    description: 'Public release history for Cortex Medical Academy.',
    path: '/updates',
  },
  utsa: {
    title: 'Free, forever, for home. | Cortex Medical Academy',
    description:
      'Free access for students at UTSA and UT Health San Antonio. Verification is still in development; courses that are already open are free for everyone.',
    path: '/utsa',
  },
  focus: {
    title: 'Focus timer. | Cortex Medical Academy',
    description: 'A focus timer for study rounds and breaks. It keeps running while you study elsewhere on Cortex.',
    path: '/focus',
  },
  learn: {
    title: 'Learn to Learn | Cortex Medical Academy',
    description: 'Learn to Learn is under construction while its lessons are reviewed.',
    path: '/learn',
  },
  anatomy: {
    title: 'Anatomy | Cortex Medical Academy',
    description: 'Anatomy is under construction while its lessons and atlas explorers are reviewed.',
    path: '/anatomy',
  },
  medicine: {
    title: 'Medicine | Cortex Medical Academy',
    description: 'Medicine is under construction while its lessons and learning flow are reviewed.',
    path: '/medicine',
  },
  neuro: {
    title: 'Neuroengineering | Cortex Medical Academy',
    description: 'Neuroengineering is under construction while its units and learning flow are reviewed.',
    path: '/neuro',
  },
  stats: {
    title: 'See what is changing. | Cortex Medical Academy',
    description:
      'See what is changing in MCAT preparation: lessons, accuracy, recall, and timed practice saved on this device.',
    path: '/stats',
  },
};

export const HOME = {
  description: MCAT_DESCRIPTION,
  path: '/',
};

export const NOT_FOUND = {
  title: 'Page not found | Cortex Medical Academy',
  description: 'That address is not part of Cortex Medical Academy.',
};

const RETIRED = new Set(['genetics', 'ccma', 'cogpsych']);

export function classify(pathname) {
  let parts;
  try {
    parts = pathname
      .split('/')
      .filter(Boolean)
      .map(part => decodeURIComponent(part));
  } catch {
    return { kind: 'missing' };
  }
  if (!parts.length) return { kind: 'home' };
  const head = parts[0].toLowerCase();
  if (head === 'index.html' || head === 'share.html' || head === 'share-clinical.html') return { kind: 'passthrough' };
  if (head === 'share' && (parts.length === 1 || (parts.length === 2 && parts[1].toLowerCase() === 'clinical')))
    return { kind: 'passthrough' };
  if (RETIRED.has(head)) return { kind: 'passthrough' };
  if (parts.length === 1 && ROUTES[head]) return { kind: 'route', key: head };
  return { kind: 'missing' };
}

const metaContent = (attr, name) => new RegExp(`(<meta ${attr}="${name}" content=")[^"]*(")`);

function rulesFor(meta) {
  const rules = [
    [/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`],
    [/(<link rel="canonical" href=")[^"]*(")/, `$1${meta.canonical}$2`],
    [metaContent('name', 'description'), `$1${meta.description}$2`],
    [metaContent('name', 'twitter:title'), `$1${meta.title}$2`],
    [metaContent('name', 'twitter:description'), `$1${meta.description}$2`],
    [metaContent('property', 'og:url'), `$1${meta.canonical}$2`],
    [metaContent('property', 'og:title'), `$1${meta.title}$2`],
    [metaContent('property', 'og:description'), `$1${meta.description}$2`],
  ];
  if (meta.image) {
    rules.push(
      [metaContent('name', 'twitter:image'), `$1${meta.image}$2`],
      [metaContent('name', 'twitter:image:alt'), `$1${meta.imageAlt}$2`],
      [metaContent('property', 'og:image'), `$1${meta.image}$2`],
      [metaContent('property', 'og:image:secure_url'), `$1${meta.image}$2`],
      [metaContent('property', 'og:image:alt'), `$1${meta.imageAlt}$2`],
      [/(<link rel="image_src" href=")[^"]*(")/, `$1${meta.image}$2`]
    );
  }
  return rules;
}

export function transform(html, meta) {
  let out = html;
  for (const [pattern, replacement] of rulesFor(meta)) {
    if (pattern.test(out)) out = out.replace(pattern, replacement);
  }
  return out;
}

function metaFor(request, kind) {
  if (kind.kind === 'missing') {
    const url = new URL(request.url);
    return {
      title: NOT_FOUND.title,
      description: NOT_FOUND.description,
      canonical: ORIGIN + url.pathname + url.search,
    };
  }
  const route = ROUTES[kind.key];
  return {
    title: route.title,
    description: route.description,
    canonical: ORIGIN + route.path,
    image: route.image,
    imageAlt: route.imageAlt,
  };
}

export default async (request, context) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return context.next();
  const url = new URL(request.url);
  const kind = classify(url.pathname);
  const response = await context.next();
  if (kind.kind === 'home' || kind.kind === 'passthrough') return response;
  if (response.status >= 300 && response.status < 400) return response;
  const passthrough = response.clone();
  try {
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html')) return passthrough;
    const html = transform(await response.text(), metaFor(request, kind));
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    const status = kind.kind === 'missing' ? 404 : response.status;
    return new Response(html, { status, headers });
  } catch {
    return passthrough;
  }
};

export const config = {
  path: '/*',
  excludedPath: [
    '/assets/*',
    '/data/*',
    '/content/*',
    '/*.js',
    '/*.css',
    '/*.json',
    '/*.jpg',
    '/*.jpeg',
    '/*.png',
    '/*.svg',
    '/*.ico',
    '/*.xml',
    '/*.txt',
    '/*.webp',
    '/*.woff',
    '/*.woff2',
  ],
};
