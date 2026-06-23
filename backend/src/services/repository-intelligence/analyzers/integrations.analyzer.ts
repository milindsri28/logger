const INTEGRATIONS: { name: string; patterns: RegExp[] }[] = [
  { name: 'OpenAI', patterns: [/\bopenai\b/i, /api\.openai\.com/i, /from\s+['"]openai['"]/i] },
  { name: 'Twilio', patterns: [/\btwilio\b/i, /api\.twilio\.com/i, /from\s+['"]twilio['"]/i] },
  { name: 'Firebase', patterns: [/\bfirebase\b/i, /firebaseio\.com/i, /from\s+['"]firebase/i] },
  { name: 'Razorpay', patterns: [/\brazorpay\b/i, /api\.razorpay\.com/i] },
  { name: 'Stripe', patterns: [/\bstripe\b/i, /api\.stripe\.com/i, /from\s+['"]stripe['"]/i] },
  { name: 'AWS', patterns: [/\baws-sdk\b/i, /@aws-sdk\//i, /\.amazonaws\.com/i, /from\s+['"]@aws-sdk/i] },
  { name: 'Google Maps', patterns: [/maps\.googleapis\.com/i, /@googlemaps\//i, /google\.maps/i] },
];

export function analyzeIntegrations(files: Map<string, string>): string[] {
  const found = new Set<string>();
  const corpus = Array.from(files.entries())
    .map(([p, c]) => `${p}\n${c}`)
    .join('\n');

  for (const { name, patterns } of INTEGRATIONS) {
    if (patterns.some((p) => p.test(corpus))) {
      found.add(name);
    }
  }

  return Array.from(found).sort();
}
