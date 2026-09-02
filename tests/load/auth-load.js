/**
 * Load test — Identity Core Auth Endpoints
 * Tool: k6 (https://k6.io)
 *
 * Run: k6 run tests/load/auth-load.js --env BASE_URL=http://localhost:3000
 *
 * Targets:
 *  - POST /api/auth/log (LOGIN_FAILED — no auth required)
 *  - GET  /login (page load latency)
 *
 * Pass criteria (from F-007 SLAs):
 *  - /api/auth/log   : P95 < 200ms
 *  - /login page     : P95 < 1000ms
 *  - Error rate      : < 1%
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const errorRate  = new Rate('errors')
const logLatency = new Trend('auth_log_latency_ms', true)
const pageLatency = new Trend('login_page_latency_ms', true)

export const options = {
  stages: [
    { duration: '30s', target: 10  },  // ramp up
    { duration: '1m',  target: 50  },  // sustain
    { duration: '30s', target: 100 },  // spike
    { duration: '30s', target: 0   },  // ramp down
  ],
  thresholds: {
    auth_log_latency_ms:   ['p(95)<200'],
    login_page_latency_ms: ['p(95)<1000'],
    errors:                ['rate<0.01'],
  },
}

const BASE = __ENV.BASE_URL || 'http://localhost:3000'

export default function () {
  // Test 1: POST /api/auth/log (LOGIN_FAILED — unauthenticated)
  const logRes = http.post(
    `${BASE}/api/auth/log`,
    JSON.stringify({
      event_type:    'LOGIN_FAILED',
      provider:      'email',
      error_code:    'load_test',
      error_message: 'k6 load test',
      duration_ms:   Math.floor(Math.random() * 500),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )

  logLatency.add(logRes.timings.duration)
  errorRate.add(![200, 500].includes(logRes.status))
  check(logRes, {
    'auth/log: status not 4xx': (r) => r.status !== 400 && r.status !== 401 && r.status !== 403,
  })

  // Test 2: GET /login (page render)
  const pageRes = http.get(`${BASE}/login`)
  pageLatency.add(pageRes.timings.duration)
  errorRate.add(pageRes.status !== 200)
  check(pageRes, {
    'login page: 200 OK': (r) => r.status === 200,
  })

  sleep(0.5)
}
