import time
from selenium import webdriver
from selenium.webdriver.common.by import By

options = webdriver.ChromeOptions()
options.add_argument('--headless')
driver = webdriver.Chrome(options=options)

try:
    # Inject error logger before page loads
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
        'source': '''
            window.errors = [];
            window.onerror = function(message, source, lineno, colno, error) {
                window.errors.push({
                    message: message,
                    source: source,
                    lineno: lineno,
                    colno: colno,
                    stack: error ? error.stack : null
                });
            };
        '''
    })

    driver.get('http://localhost:5173/')
    time.sleep(2)
    
    # Admin Login
    driver.find_element(By.XPATH, "//input[@type='email']").send_keys('admin@smartattend.edu')
    driver.find_element(By.XPATH, "//input[@type='password']").send_keys('admin123')
    driver.find_element(By.XPATH, "//button[@type='submit']").click()
    time.sleep(2)
    
    # Navigate to Reports
    driver.get('http://localhost:5173/admin/reports')
    time.sleep(3)
    
    # Capture errors
    errors = driver.execute_script("return window.errors;")
    print("CATCH_ERRORS_START")
    import json
    print(json.dumps(errors, indent=2))
    print("CATCH_ERRORS_END")
    
    # Standard logs
    print("BROWSER_LOGS_START")
    for entry in driver.get_log('browser'):
        print(entry)
    print("BROWSER_LOGS_END")
finally:
    driver.quit()
