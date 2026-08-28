/* Per-path social cards for the SPA: /practice serves the same app HTML, but with
   Clinical Scenarios meta so shared links unfurl with the clinical card instead of
   the site-wide one. Crawlers never run JS, so this has to happen at the edge.
   Any failure falls back to the untransformed page. */

const OG = {
  title: 'Clinical Scenarios — Cortex Medical Academy',
  description: "Start your shift: interview the patient, examine, order tests, decide — then chart your note and compare it against the clinician's. 2,599+ cases across 26 specialties, free.",
  image: 'https://cortexmedical.academy/og-clinical.jpg',
  imageAlt: 'Clinical Scenarios — start your shift: interview, examine, decide, and chart. Free, no sign-up.',
  url: 'https://cortexmedical.academy/practice',
};

const metaContent = (attr, name) =>
  new RegExp(`(<meta ${attr}="${name}" content=")[^"]*(")`);

const RULES = [
  [/<title>[^<]*<\/title>/, `<title>${OG.title}</title>`],
  [/(<link rel="canonical" href=")[^"]*(")/, `$1${OG.url}$2`],
  [metaContent('name', 'twitter:title'), `$1${OG.title}$2`],
  [metaContent('name', 'twitter:description'), `$1${OG.description}$2`],
  [metaContent('name', 'twitter:image'), `$1${OG.image}$2`],
  [metaContent('name', 'twitter:image:alt'), `$1${OG.imageAlt}$2`],
  [metaContent('property', 'og:url'), `$1${OG.url}$2`],
  [metaContent('property', 'og:title'), `$1${OG.title}$2`],
  [metaContent('property', 'og:description'), `$1${OG.description}$2`],
  [metaContent('property', 'og:image'), `$1${OG.image}$2`],
  [metaContent('property', 'og:image:secure_url'), `$1${OG.image}$2`],
  [metaContent('property', 'og:image:alt'), `$1${OG.imageAlt}$2`],
  [/(<link rel="image_src" href=")[^"]*(")/, `$1${OG.image}$2`],
];

export function transform(html) {
  let out = html;
  let applied = 0;
  for (const [pattern, replacement] of RULES) {
    if (pattern.test(out)) {
      // replacement via groups $1/$2; values contain no `$`, so this is safe
      out = out.replace(pattern, replacement);
      applied += 1;
    }
  }
  return { html: out, applied };
}

export default async (request, context) => {
  const response = await context.next();
  const passthrough = response.clone();
  try {
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html')) return passthrough;
    const { html } = transform(await response.text());
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(html, { status: response.status, headers });
  } catch {
    return passthrough;
  }
};

export const config = { path: ['/practice', '/practice/*'] };
