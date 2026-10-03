// Lighthouse CI (map Section 12): mobile budgets on one Phase-1 page per template.
// Lighthouse's default form factor is mobile (Moto G Power emulation, slow 4G).
//
// INP is a field metric that lab runs can't measure. Total Blocking Time is the standard lab proxy:
// TBT under 200 ms tracks INP under 200 ms. Check real INP in Search Console's Core Web Vitals report after launch.
module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      numberOfRuns: 3,
      url: [
        'http://localhost/',
        'http://localhost/pricing/',
        'http://localhost/pricing/cost-to-move-a-couch/',
        'http://localhost/services/furniture-delivery/',
        'http://localhost/services/furniture-delivery/couch-delivery/',
        'http://localhost/cities/fresno/',
        'http://localhost/guides/will-it-fit-in-a-pickup-bed/',
        'http://localhost/drive/',
        'http://localhost/legal/terms/',
        'http://localhost/book/?item=couch',
      ],
    },
    assert: {
      // /book/ is noindex app UI (no canonical, no meta description by design), so the SEO category
      // doesn't apply there; performance and accessibility budgets still do.
      assertMatrix: [
        {
          matchingUrlPattern: '^(?!.*/book/).*$',
          assertions: {
            'largest-contentful-paint': ['error', { maxNumericValue: 2500, aggregationMethod: 'median-run' }],
            'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, aggregationMethod: 'median-run' }],
            'total-blocking-time': ['error', { maxNumericValue: 200, aggregationMethod: 'median-run' }],
            'categories:accessibility': ['error', { minScore: 0.95 }],
            'categories:seo': ['error', { minScore: 0.95 }],
          },
        },
        {
          matchingUrlPattern: '.*/book/.*',
          assertions: {
            'largest-contentful-paint': ['error', { maxNumericValue: 2500, aggregationMethod: 'median-run' }],
            'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, aggregationMethod: 'median-run' }],
            'total-blocking-time': ['error', { maxNumericValue: 200, aggregationMethod: 'median-run' }],
            'categories:accessibility': ['error', { minScore: 0.95 }],
          },
        },
      ],
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci' },
  },
};
