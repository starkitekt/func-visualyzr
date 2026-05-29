const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // 1. DESKTOP CAPTURE
  console.log('Navigating to local index.html (Desktop View)...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file:///C:/Users/abhis/gemini_workspace/animated-graph/index.html', {
    waitUntil: 'load'
  });
  
  console.log('Waiting for animation to complete...');
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  console.log('Taking desktop screenshot...');
  const desktopPath = 'C:\\Users\\abhis\\.gemini\\antigravity-ide\\brain\\bb70a50a-f24a-4d65-a4a3-8709aeb09f46\\app_screenshot.png';
  await page.screenshot({ path: desktopPath });
  console.log('Desktop screenshot saved: ' + desktopPath);

  // 1b. DESKTOP WITH KEYBOARD OPEN
  console.log('Toggling math keyboard on desktop...');
  await page.click('.kbd-toggle');
  await new Promise(resolve => setTimeout(resolve, 500)); // wait for transition
  console.log('Taking desktop keyboard open screenshot...');
  const desktopOpenPath = 'C:\\Users\\abhis\\.gemini\\antigravity-ide\\brain\\bb70a50a-f24a-4d65-a4a3-8709aeb09f46\\app_screenshot_desktop_open.png';
  await page.screenshot({ path: desktopOpenPath });
  console.log('Desktop keyboard open screenshot saved: ' + desktopOpenPath);

  // Close keyboard on desktop for subsequent states
  await page.click('.kbd-close-btn');
  await new Promise(resolve => setTimeout(resolve, 500));

  // 1c. DESKTOP WITH SIDEBAR COLLAPSED
  console.log('Collapsing settings sidebar on desktop...');
  await page.click('#sidebarToggleBtn');
  await new Promise(resolve => setTimeout(resolve, 500)); // wait for collapse transition
  console.log('Taking desktop sidebar collapsed screenshot...');
  const desktopCollapsedPath = 'C:\\Users\\abhis\\.gemini\\antigravity-ide\\brain\\bb70a50a-f24a-4d65-a4a3-8709aeb09f46\\app_screenshot_desktop_collapsed.png';
  await page.screenshot({ path: desktopCollapsedPath });
  console.log('Desktop sidebar collapsed screenshot saved: ' + desktopCollapsedPath);

  // Expand sidebar back for mobile transition logic
  await page.click('#sidebarToggleBtn');
  await new Promise(resolve => setTimeout(resolve, 500));

  // 2. MOBILE CAPTURE (Closed Sidebar)
  console.log('Setting viewport to mobile (375x667)...');
  await page.setViewport({ width: 375, height: 667 });
  await new Promise(resolve => setTimeout(resolve, 500)); // wait for transition

  console.log('Taking mobile closed screenshot...');
  const mobileClosedPath = 'C:\\Users\\abhis\\.gemini\\antigravity-ide\\brain\\bb70a50a-f24a-4d65-a4a3-8709aeb09f46\\app_screenshot_mobile.png';
  await page.screenshot({ path: mobileClosedPath });
  console.log('Mobile closed screenshot saved: ' + mobileClosedPath);

  // 3. MOBILE CAPTURE (Open Sidebar & Keyboard Active)
  console.log('Toggling mobile Menu sidebar...');
  await page.click('#sidebarToggleBtn');
  await new Promise(resolve => setTimeout(resolve, 500)); // wait for slide transition

  console.log('Toggling math keyboard...');
  await page.click('.kbd-toggle');
  await new Promise(resolve => setTimeout(resolve, 500)); // wait for slide-up

  console.log('Switching keyboard tab to "Functions"...');
  await page.click('[data-tab="functions"]');
  await new Promise(resolve => setTimeout(resolve, 500)); // wait for tab switch

  console.log('Taking mobile open sidebar + keyboard screenshot...');
  const mobileOpenPath = 'C:\\Users\\abhis\\.gemini\\antigravity-ide\\brain\\bb70a50a-f24a-4d65-a4a3-8709aeb09f46\\app_screenshot_mobile_open.png';
  await page.screenshot({ path: mobileOpenPath });
  console.log('Mobile open sidebar screenshot saved: ' + mobileOpenPath);

  await browser.close();
  console.log('All screenshots successfully captured!');
})();
