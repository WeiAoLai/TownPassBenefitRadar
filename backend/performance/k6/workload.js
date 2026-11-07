import http from 'k6/http';
import encoding from 'k6/encoding';
import { check, fail, sleep } from 'k6';

const artworkPng = encoding.b64decode(
  open('./fixtures/artwork.png.b64').replace(/\s+/g, ''),
);

const userA = __ENV.K6_USER_A || 'user-a';
const userB = __ENV.K6_USER_B || 'user-b';
const iterationSleep = nonNegativeNumberFromEnv('ITERATION_SLEEP_SECONDS', 1);

export function buildOptions() {
  const readP95 = __ENV.READ_P95_MS
    ? `p(95)<${positiveIntegerFromEnv('READ_P95_MS', 500)}`
    : 'p(95)<500';
  const writeP95 = __ENV.WRITE_P95_MS
    ? `p(95)<${positiveIntegerFromEnv('WRITE_P95_MS', 2000)}`
    : 'p(95)<2000';
  const maximumFailureRate = numberFromEnv('MAX_FAILURE_RATE', 0.01, 0);
  const minimumCheckRate = numberFromEnv('MIN_CHECK_RATE', 0.99, 0);

  return {
    scenarios: {
      read_traffic: {
        executor: 'ramping-vus',
        exec: 'readJourney',
        gracefulRampDown: '10s',
        stages: stagesFor('READ', [5, 20, 50, 0]),
      },
      write_traffic: {
        executor: 'ramping-vus',
        exec: 'writeJourney',
        gracefulRampDown: '15s',
        stages: stagesFor('WRITE', [1, 4, 10, 0]),
      },
    },
    thresholds: {
      http_req_failed: [`rate<${maximumFailureRate}`],
      checks: [`rate>${minimumCheckRate}`],
      'http_req_duration{scenario:read_traffic}': [readP95],
      'http_req_duration{scenario:write_traffic}': [writeP95],
    },
  };
}

export function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

export function setupWorkload(baseUrl) {
  const backgroundsResponse = http.get(
    `${baseUrl}/v1/backgrounds`,
    requestParams(userA, 'setup', 'GET /v1/backgrounds'),
  );
  if (!check(backgroundsResponse, { 'setup backgrounds status is 200': (response) => response.status === 200 })) {
    fail(`Cannot load backgrounds: HTTP ${backgroundsResponse.status}`);
  }
  const backgrounds = parseJson(backgroundsResponse, 'backgrounds');
  const background = backgrounds.find((item) => item.unlocked);
  if (!background) {
    fail('No unlocked background is available for the load test');
  }

  const policyResponse = http.get(
    `${baseUrl}/v1/policies/random`,
    requestParams(userA, 'setup', 'GET /v1/policies/random'),
  );
  if (!check(policyResponse, { 'setup policy status is 200': (response) => response.status === 200 })) {
    fail(`Cannot load a policy: HTTP ${policyResponse.status}`);
  }
  const policy = parseJson(policyResponse, 'policy');

  return {
    backgroundId: background.id,
    policyId: policy.id,
  };
}

export function runReadJourney(baseUrl) {
  checkedGet(baseUrl, '/v1/me', userA, 'GET /v1/me');
  checkedGet(baseUrl, '/v1/backgrounds', userA, 'GET /v1/backgrounds');
  checkedGet(baseUrl, '/v1/policies/random', userA, 'GET /v1/policies/random');

  const listResponse = checkedGet(
    baseUrl,
    '/v1/artworks?page=0&size=20',
    userA,
    'GET /v1/artworks',
  );
  if (listResponse.status === 200) {
    const page = parseJson(listResponse, 'artwork page');
    if (Array.isArray(page.content) && page.content.length > 0) {
      const artwork = page.content[Math.floor(Math.random() * page.content.length)];
      checkedGet(baseUrl, `/v1/artworks/${artwork.id}`, userA, 'GET /v1/artworks/{id}');
    }
  }

  checkedGet(baseUrl, '/v1/leaderboard', userA, 'GET /v1/leaderboard');
  sleep(iterationSleep);
}

export function runWriteJourney(baseUrl, setupData) {
  const createResponse = http.post(
    `${baseUrl}/v1/artworks`,
    {
      image: http.file(artworkPng, 'k6-artwork.png', 'image/png'),
      backgroundId: String(setupData.backgroundId),
      policyId: String(setupData.policyId),
      sloganText: `k6 壓測作品 ${__VU}-${__ITER}`,
    },
    requestParams(userA, 'write', 'POST /v1/artworks'),
  );
  const created = check(createResponse, {
    'create artwork status is 201': (response) => response.status === 201,
  });
  if (!created) {
    sleep(iterationSleep);
    return;
  }

  const artwork = parseJson(createResponse, 'created artwork');
  checkedMutation(
    http.put(
      `${baseUrl}/v1/artworks/${artwork.id}/like`,
      null,
      requestParams(userB, 'write', 'PUT /v1/artworks/{id}/like'),
    ),
    'like artwork status is 200',
  );

  const downloadResponse = http.get(
    `${baseUrl}/v1/artworks/${artwork.id}/download`,
    requestParams(userB, 'write', 'GET /v1/artworks/{id}/download'),
  );
  check(downloadResponse, {
    'download artwork status is 200': (response) => response.status === 200,
    'download artwork is PNG': (response) => (response.headers['Content-Type'] || '').includes('image/png'),
  });

  checkedMutation(
    http.del(
      `${baseUrl}/v1/artworks/${artwork.id}/like`,
      null,
      requestParams(userB, 'write', 'DELETE /v1/artworks/{id}/like'),
    ),
    'unlike artwork status is 200',
  );
  sleep(iterationSleep);
}

export function buildSummary(data, path) {
  const requests = data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0;
  const failures = data.metrics.http_req_failed ? data.metrics.http_req_failed.values.rate : 0;
  const p95 = data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'] : 0;
  const checksRate = data.metrics.checks ? data.metrics.checks.values.rate : 0;
  const output = [
    '',
    'Good Morning k6 summary',
    `requests: ${requests}`,
    `failed rate: ${(failures * 100).toFixed(2)}%`,
    `checks rate: ${(checksRate * 100).toFixed(2)}%`,
    `overall p95: ${p95.toFixed(2)} ms`,
    `json summary: ${path}`,
    '',
  ].join('\n');

  return {
    stdout: output,
    [path]: JSON.stringify(data, null, 2),
  };
}

function checkedGet(baseUrl, path, user, endpoint) {
  const response = http.get(
    `${baseUrl}${path}`,
    requestParams(user, 'read', endpoint),
  );
  check(response, { [`${endpoint} status is 200`]: (result) => result.status === 200 });
  return response;
}

function checkedMutation(response, checkName) {
  check(response, { [checkName]: (result) => result.status === 200 });
}

function requestParams(user, workflow, endpoint) {
  return {
    headers: { 'X-Demo-User': user },
    tags: { workflow, endpoint },
  };
}

function parseJson(response, label) {
  try {
    return response.json();
  } catch (error) {
    fail(`Cannot parse ${label} JSON: ${error.message}`);
  }
}

function stagesFor(prefix, defaults) {
  return [
    { duration: __ENV.WARMUP_DURATION || '30s', target: integerFromEnv(`${prefix}_WARMUP_VUS`, defaults[0]) },
    { duration: __ENV.NORMAL_DURATION || '1m', target: integerFromEnv(`${prefix}_NORMAL_VUS`, defaults[1]) },
    { duration: __ENV.PEAK_DURATION || '2m', target: integerFromEnv(`${prefix}_PEAK_VUS`, defaults[2]) },
    { duration: __ENV.COOLDOWN_DURATION || '30s', target: integerFromEnv(`${prefix}_COOLDOWN_VUS`, defaults[3]) },
  ];
}

function integerFromEnv(name, fallback) {
  const value = Number.parseInt(__ENV[name] || String(fallback), 10);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function positiveIntegerFromEnv(name, fallback) {
  const value = integerFromEnv(name, fallback);
  if (value < 1) {
    throw new Error(`${name} must be greater than zero`);
  }
  return value;
}

function numberFromEnv(name, fallback, minimumExclusive) {
  const value = Number.parseFloat(__ENV[name] || String(fallback));
  if (!Number.isFinite(value) || value <= minimumExclusive || value > 1) {
    throw new Error(`${name} must be greater than ${minimumExclusive} and at most 1`);
  }
  return value;
}

function nonNegativeNumberFromEnv(name, fallback) {
  const value = Number.parseFloat(__ENV[name] || String(fallback));
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return value;
}
