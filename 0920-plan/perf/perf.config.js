import { defineConfig } from '@playwright/test';

// minify 를 끈 production 빌드를 띄워 CPU profile 의 함수 이름을 읽는다.
// 빌드: npx vite build --minify false --outDir <PERF_DIST> --emptyOutDir (PWA precache 크기 오류는 무시해도 산출물은 나온다)
const PORT = 4177;
const DIST = process.env.PERF_DIST || 'dist-perf';
export default defineConfig({
  testDir: '.', testMatch: /world-perf\.spec\.js/, timeout: 600000, workers: 1, reporter: 'line',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`, headless: true, serviceWorkers: 'block',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
      // vsync 를 풀어 GPU 와 CPU 가 낼 수 있는 최대 프레임을 잰다. 60Hz 에 묶이면 A/B 차이가 안 보인다.
      args: ['--use-gl=angle', `--use-angle=${process.env.PERF_ANGLE || 'gl'}`, '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
        '--disable-gpu-vsync', '--disable-frame-rate-limit', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: `npx vite preview --outDir ${DIST} --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`, reuseExistingServer: false, timeout: 60000, cwd: '../..',
  },
});
