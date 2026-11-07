import {
  buildOptions,
  buildSummary,
  normalizeBaseUrl,
  runReadJourney,
  runWriteJourney,
  setupWorkload,
} from './workload.js';

if (!__ENV.BASE_URL) {
  throw new Error('BASE_URL is required, for example https://api.example.com/api');
}

const baseUrl = normalizeBaseUrl(__ENV.BASE_URL);

export const options = buildOptions();

export function setup() {
  return setupWorkload(baseUrl);
}

export function readJourney() {
  runReadJourney(baseUrl);
}

export function writeJourney(data) {
  runWriteJourney(baseUrl, data);
}

export function handleSummary(data) {
  return buildSummary(data, '/results/aws-summary.json');
}
