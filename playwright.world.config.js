import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests', testMatch:'world.spec.js', timeout:45000, workers:1,
  use:{baseURL:'http://127.0.0.1:4175',headless:true,serviceWorkers:'block',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4175 --strictPort',url:'http://127.0.0.1:4175',reuseExistingServer:true,timeout:30000},
});
