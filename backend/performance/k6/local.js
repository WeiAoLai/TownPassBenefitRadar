import {
  buildOptions,
  buildSummary,
  normalizeBaseUrl,
  runReadJourney,
  runWriteJourney,
  setupWorkload,
} from './workload.js';

const baseUrl = normalizeBaseUrl(__ENV.BASE_URL || 'http://api:8080/api');

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
  return buildSummary(data, '/results/local-summary.json');
}
