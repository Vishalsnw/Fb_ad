// Prevent multiple script loading
if (window.adGeneratorLoaded) {
    console.log('Ad Generator script already loaded, skipping...');
} else {
    window.adGeneratorLoaded = true;
}

// API Configuration
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPAI_API_URL = 'https://api.deepai.org/api/text2img';

// Global variables
let adsUsed = 0;
let userPlan = 'free';
let currentAdData = null;
let currentImageUrl = null;
let isGenerating = false;

// Load configuration
let CONFIG = {};
let DEEPSEEK_API_KEY = '';
let DEEPAI_API_KEY = '';
let configLoaded = false;

async function loadConfig() {
    if (configLoaded) {
        console.log('✅ Config already loaded, skipping...');
        return true;
    }
    try {
        const timestamp = Date.now();
        const response = await fetch(`/config.js?t=${timestamp}`);

        if (!response.ok) {
            throw new Error(`Config fetch failed: ${response.status}`);
        }

        const configScript = await response.text();

        // Create a safe execution context
        const scriptElement = document.createElement('script');
        scriptElement.textContent = configScript;
        document.head.appendChild(scriptElement);
        document.head.removeChild(scriptElement);

        // Wait for CONFIG to be available with retry
        let retries = 0;
        const maxRetries = 10;

        while (!window.CONFIG && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }

        if (window.CONFIG) {
            CONFIG = window.CONFIG;
            DEEPSEEK_API_KEY = CONFIG.DEEPSEEK_API_KEY || '';
            DEEPAI_API_KEY = CONFIG.DEEPAI_API_KEY || '';

            console.log('🔧 Raw config loaded:', {
                hasDeepSeek: !!CONFIG.DEEPSEEK_API_KEY,
                hasDeepAI: !!CONFIG.DEEPAI_API_KEY,
                deepSeekLength: CONFIG.DEEPSEEK_API_KEY ? CONFIG.DEEPSEEK_API_KEY.length : 0,
                deepAILength: CONFIG.DEEPAI_API_KEY ? CONFIG.DEEPAI_API_KEY.length : 0
            });

            // Validate keys are not empty strings
            const hasDeepSeek = DEEPSEEK_API_KEY && DEEPSEEK_API_KEY.trim().length > 5; // API keys should be at least 6 chars
            const hasDeepAI = DEEPAI_API_KEY && DEEPAI_API_KEY.trim().length > 5;

            console.log('DEEPSEEK_API_KEY loaded:', hasDeepSeek, DEEPSEEK_API_KEY ? `(${DEEPSEEK_API_KEY.length} chars)` : '(empty)');
            console.log('DEEPAI_API_KEY loaded:', hasDeepAI, DEEPAI_API_KEY ? `(${DEEPAI_API_KEY.length} chars)` : '(empty)');

            if (hasDeepSeek && hasDeepAI) {
                console.log('✅ All AI API keys loaded successfully');

                // Check Razorpay keys
                if (CONFIG.RAZORPAY_KEY_ID && CONFIG.RAZORPAY_KEY_SECRET) {
                    console.log('✅ Razorpay keys loaded in main script');
                } else {
                    console.warn('⚠️ Razorpay keys not found in config');
                }

                configLoaded = true;
                return true;
            } else {
                const missingKeys = [];
                if (!hasDeepSeek) missingKeys.push('DEEPSEEK_API_KEY');
                if (!hasDeepAI) missingKeys.push('DEEPAI_API_KEY');

                console.error('❌ Missing API keys:', missingKeys);
                console.log('🔧 To fix this:');
                console.log('   1. Go to Secrets tab in Replit (left sidebar)');
                console.log('   2. Add DEEPSEEK_API_KEY with your DeepSeek API key');
                console.log('   3. Add DEEPAI_API_KEY with your DeepAI API key');
                console.log('   4. Refresh the page');

                // Show user-friendly error
                showError(`
                    Missing API Keys: ${missingKeys.join(', ')}<br><br>
                    <strong>To fix this:</strong><br>
                    1. Click on "Secrets" in the left sidebar<br>
                    2. Add <code>DEEPSEEK_API_KEY</code> with your DeepSeek API key<br>
                    3. Add <code>DEEPAI_API_KEY</code> with your DeepAI API key<br>
                    4. Refresh this page<br><br>
                    <a href="#" onclick="location.reload()" style="color: #667eea; text-decoration: underline;">Click here to refresh</a>
                `);

                throw new Error(`Missing API keys: ${missingKeys.join(', ')}`);
            }
        } else {
            throw new Error('CONFIG not available after loading');
        }

    } catch (error) {
        console.error('❌ Failed to load config:', error);
        showError('Failed to load configuration. Please check your API keys and refresh the page.');
        return false;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 App initializing...');

    // Load user data
    loadUserData();

    // Setup form submission
    const form = document.getElementById('adForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmission);
    }

    // Update usage display
    updateUsageDisplay();

    // Setup UI first
    setupEventListeners();
    setupLanguagePlaceholders();
    setupCopyProtection();

    // Initialize usage display for anonymous users
    const currentUser = typeof window.currentUser === 'function' ? window.currentUser() : null;
    if (!currentUser) {
        updateUsageDisplay();
    }

    // Then load config
    const configLoaded = loadConfig();
    if (configLoaded) {
        console.log('✅ Application initialized successfully');
    } else {
        console.error('❌ Failed to initialize application');
    }

    console.log('✅ App initialized');
});

function setupCopyProtection() {
    // Disable right-click context menu on ad preview
    document.addEventListener('contextmenu', function(e) {
        if (e.target.closest('.ad-preview')) {
            e.preventDefault();
            return false;
        }
    });

    // Disable text selection on ad preview
    document.addEventListener('selectstart', function(e) {
        if (e.target.closest('.ad-preview')) {
            e.preventDefault();
            return false;
        }
    });

    // Disable drag and drop on images
    document.addEventListener('dragstart', function(e) {
        if (e.target.closest('.ad-image')) {
            e.preventDefault();
            return false;
        }
    });

    // Disable common keyboard shortcuts for screenshots and copying
    document.addEventListener('keydown', function(e) {
        if (e.target.closest('.ad-preview')) {
            // Disable Ctrl+A, Ctrl+C, Ctrl+S, Ctrl+P, PrintScreen, etc.
            if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'c' || e.key === 's' || e.key === 'p')) {
                e.preventDefault();
                return false;
            }
            if (e.key === 'PrintScreen' || e.key === 'F12') {
                e.preventDefault();
                return false;
            }
        }
    });

    // Add screenshot detection
    let isScreenshotAttempt = false;
    document.addEventListener('keyup', function(e) {
        if (e.key === 'PrintScreen') {
            isScreenshotAttempt = true;
            showScreenshotWarning();
        }
    });

    // Detect if page becomes hidden (possible screenshot)
    document.addEventListener('visibilitychange', function() {
        if (document.hidden && isScreenshotAttempt) {
            setTimeout(() => {
                showScreenshotWarning();
                isScreenshotAttempt = false;
            }, 100);
        }
    });
}

function showScreenshotWarning() {
    alert('⚠️ Screenshots are not allowed. Please use the download button to save your ad.');
}

function setupEventListeners() {
    const form = document.getElementById('adForm');
    const generateButton = document.getElementById('generateButton');

    if (form) {
        form.removeEventListener('submit', handleFormSubmit); // Remove existing
        //form.addEventListener('submit', handleFormSubmit);  //Replaced with handleFormSubmission
        console.log('✅ Form submit event listener attached');
    }

    // Also attach to generate button directly
    if (generateButton) {
        generateButton.removeEventListener('click', handleGenerateClick);
        generateButton.addEventListener('click', handleGenerateClick);
        console.log('✅ Generate button click event listener attached');
    }

    // Note: Download, regenerate, copy, and variations buttons are dynamically created
    // Event listeners for these are attached in displayResults function
}

// Handle generate button click
function handleGenerateClick(event) {
    event.preventDefault();
    console.log('🖱️ Generate button clicked');
    //handleFormSubmit(event); //Replaced with handleFormSubmission
    handleFormSubmission(event);
}

function setupLanguagePlaceholders() {
    const languageRadios = document.querySelectorAll('input[name="language"]');

    languageRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                updatePlaceholders(this.value);
            }
        });
    });

    // Set initial placeholders
    const checkedRadio = document.querySelector('input[name="language"]:checked');
    if (checkedRadio) {
        updatePlaceholders(checkedRadio.value);
    }
}

function updatePlaceholders(language) {
    const placeholders = {
        'Hindi': {
            productName: 'उदाहरण: प्रीमियम अगरबत्ती',
            productDescription: 'आपके उत्पाद या सेवा का विवरण दें',
            targetAudience: 'जैसे: धार्मिक परिवार, 25-45 वर्ष'
        },
        'English': {
            productName: 'e.g., Premium Incense Sticks',
            productDescription: 'Describe your product or service',
            targetAudience: 'e.g., Religious families, age 25-45'
        }
    };

    const currentPlaceholders = placeholders[language] || placeholders['English'];

    const productNameInput = document.getElementById('productName');
    const productDescInput = document.getElementById('productDescription');
    const targetAudienceInput = document.getElementById('targetAudience');

    if (productNameInput) productNameInput.placeholder = currentPlaceholders.productName;
    if (productDescInput) productDescInput.placeholder = currentPlaceholders.productDescription;
    if (targetAudienceInput) targetAudienceInput.placeholder = currentPlaceholders.targetAudience;
}

// Load user data from localStorage
function loadUserData() {
    try {
        const savedAdsUsed = localStorage.getItem('adsUsed');
        const savedUserPlan = localStorage.getItem('userPlan');

        if (savedAdsUsed !== null) {
            adsUsed = parseInt(savedAdsUsed, 10) || 0;
        }

        if (savedUserPlan) {
            userPlan = savedUserPlan;
        }

        console.log(`📊 User data loaded: ${adsUsed} ads used, plan: ${userPlan}`);
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Save user data to localStorage
function saveUserData() {
    try {
        localStorage.setItem('adsUsed', adsUsed.toString());
        localStorage.setItem('userPlan', userPlan);
        console.log('💾 User data saved');
    } catch (error) {
        console.error('Error saving user data:', error);
    }
}

// Update usage display
function updateUsageDisplay() {
    let usageDisplay = document.getElementById('usageDisplay');

    if (!usageDisplay) {
        const header = document.querySelector('header');
        if (header) {
            usageDisplay = document.createElement('div');
            usageDisplay.id = 'usageDisplay';
            usageDisplay.style.cssText = `
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 10px 20px;
                border-radius: 25px;
                font-size: 0.9rem;
                font-weight: 600;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                margin-left: auto;
            `;
            header.appendChild(usageDisplay);
        }
    }

    if (usageDisplay) {
        if (userPlan === 'premium') {
            usageDisplay.innerHTML = `⭐ Premium - Unlimited ads`;
        } else {
            const remaining = Math.max(0, 4 - adsUsed);
            usageDisplay.innerHTML = `🎯 ${remaining}/4 ads remaining ${remaining === 0 ? '- <span style="text-decoration: underline; cursor: pointer;" onclick="showPaymentModal()">Upgrade Now</span>' : ''}`;
        }
    }
}

// Show login required modal
function showLoginRequiredModal() {
    let modal = document.getElementById('loginRequiredModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'loginRequiredModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                padding: 40px;
                border-radius: 20px;
                text-align: center;
                max-width: 500px;
                margin: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            ">
                <div style="font-size: 4rem; margin-bottom: 20px;">🚀</div>
                <h2 style="color: #333; margin-bottom: 15px;">Login Required!</h2>
                <p style="color: #666; font-size: 1.1rem; margin-bottom: 30px; line-height: 1.6;">
                    Please sign in with your Google account to start generating amazing ads with our premium features!
                </p>
                <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="signInForMore()" style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        border-radius: 10px;
                        font-size: 1.1rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: transform 0.3s ease;
                    ">🔑 Sign In with Google</button>
                    <button onclick="closeLoginModal()" style="
                        background: #f0f0f0;
                        color: #666;
                        border: none;
                        padding: 15px 30px;
                        border-radius: 10px;
                        font-size: 1.1rem;
                        cursor: pointer;
                    ">Maybe Later</button>
                </div>
                <p style="color: #999; font-size: 0.9rem; margin-top: 20px;">
                    Get unlimited ads, premium templates, and priority support!
                </p>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
}

// Close login modal
function closeLoginModal() {
    const modal = document.getElementById('loginRequiredModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Sign in for more ads
function signInForMore() {
    if (typeof window.signIn === 'function') {
        window.signIn();
    } else {
        console.error('signIn function not available');
        alert('Sign in functionality is not available. Please check your internet connection.');
    }
    closeLoginModal();
}

// Handle form submission
async function handleFormSubmission(event) {
    event.preventDefault();

    const user = typeof window.currentUser === 'function' ? window.currentUser() : null;

    // Check if user is logged in and has remaining ads
    if (!user) {
        showLoginRequiredModal();
        return;
    }

    if (typeof window.canGenerateAd === 'function' && !window.canGenerateAd()) {
        showPaymentModal();
        return;
    }

    // Validate form data
    const formData = collectFormData();
    if (!validateFormData(formData)) {
        return;
    }

    // Show loading state
    showLoading();
    document.getElementById('resultSection').style.display = 'block';

    try {
        // Generate the ad
        const result = await generateAd(formData);

        if (result.success) {
            // Increment usage count
            if (typeof window.incrementAdUsage === 'function') {
                const limitReached = window.incrementAdUsage();
                if (limitReached) {
                    // Show upgrade modal after successful generation
                    setTimeout(() => showPaymentModal(), 2000);
                }
            } else {
                adsUsed++;
                saveUserData();
                updateUsageDisplay();
            }

            displayResults(result);
        } else {
            showError(result.error || 'Failed to generate ad');
        }
    } catch (error) {
        console.error('Generation error:', error);
        showError('Network error. Please check your connection and try again.');
    }
}

// Collect form data
function collectFormData() {
    const productName = document.getElementById('productName');
    const productDescription = document.getElementById('productDescription');
    const targetAudience = document.getElementById('targetAudience');
    const businessType = document.getElementById('businessType');
    const specialOffer = document.getElementById('specialOffer');
    const tone = document.getElementById('tone');
    const adFormat = document.getElementById('adFormat');
    const competitorUrl = document.getElementById('competitorUrl');

    // Get language from radio buttons
    const languageRadio = document.querySelector('input[name="language"]:checked');
    const language = languageRadio ? languageRadio.value : 'English';

    return {
        productName: productName ? productName.value.trim() : '',
        productDescription: productDescription ? productDescription.value.trim() : '',
        targetAudience: targetAudience ? targetAudience.value.trim() : '',
        specialOffer: specialOffer ? specialOffer.value.trim() : '',
        language: language,
        tone: tone ? tone.value : 'professional',
        adFormat: adFormat ? adFormat.value : 'facebook-feed',
        businessType: businessType ? businessType.value : '',
        competitorUrl: competitorUrl ? competitorUrl.value.trim() : ''
    };
}

// Validate form data
function validateFormData(formData) {
    if (!formData.productName || !formData.productName.trim()) {
        console.log('❌ Product name missing');
        showError('Please enter a product name');
        return false;
    }
    if (!formData.productDescription || !formData.productDescription.trim()) {
        console.log('❌ Product description missing');
        showError('Please describe your product or service');
        return false;
    }
    if (!formData.targetAudience || !formData.targetAudience.trim()) {
        console.log('❌ Target audience missing');
        showError('Please specify your target audience');
        return false;
    }

    console.log('✅ All required fields validated');
    return true;
}

// Show loading animation
function showLoading() {
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.innerHTML = `
            <div class="loading-3d">
                <div class="loading-cube">
                    <div class="cube-face front">🎨</div>
                    <div class="cube-face back">🚀</div>
                    <div class="cube-face right">💡</div>
                    <div class="cube-face left">🔥</div>
                    <div class="cube-face top">⭐</div>
                    <div class="cube-face bottom">✨</div>
                </div>
                <div class="loading-text">
                    <h3>Creating Your Perfect Ad</h3>
                    <div class="loading-steps-3d">
                        <div class="step-3d active">🔍 Analyzing your product...</div>
                        <div class="step-3d">🎨 Designing visuals...</div>
                        <div class="step-3d">✨ Crafting compelling copy...</div>
                        <div class="step-3d">🚀 Finalizing your ad...</div>
                    </div>
                </div>
                <div class="loading-progress-bar">
                    <div class="loading-progress-fill"></div>
                </div>
            </div>
        `;
        resultsDiv.style.display = 'block';
        animateLoadingSteps();
    }
}

// Animate loading steps
function animateLoadingSteps() {
    const steps = document.querySelectorAll('.step-3d');
    let stepIndex = 0;
    let progress = 0;

    const interval = setInterval(() => {
        progress += 2;
        const progressBar = document.querySelector('.loading-progress-fill');
        if (progressBar) {
            progressBar.style.width = `${Math.min(progress, 100)}%`;
        }

        const newStepIndex = Math.floor(progress / 25);
        if (newStepIndex > stepIndex && newStepIndex < steps.length) {
            steps[stepIndex].classList.remove('active');
            steps[newStepIndex].classList.add('active');
            stepIndex = newStepIndex;
        }

        if (progress >= 100) {
            clearInterval(interval);
        }
    }, 200);
}

// Show error message
function showError(message) {
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.innerHTML = `
            <div class="error-message" style="
                padding: 30px;
                background: #fff5f5;
                border: 2px solid #feb2b2;
                border-radius: 12px;
                margin: 20px 0;
                text-align: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <h3 style="color: #e53e3e; margin-bottom: 15px; font-size: 1.5rem;">❌ Configuration Error</h3>
                <div style="color: #2d3748; line-height: 1.6; margin-bottom: 20px;">
                    ${message}
                </div>
                <button onclick="location.reload()" style="
                    background: #667eea;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: background 0.3s ease;
                " class="retry-btn">Refresh Page</button>
            </div>
        `;
        resultsDiv.style.display = 'block';
        resultsDiv.scrollIntoView({ behavior: 'smooth' });
    }
    console.error('Error:', message);
}

// Generate ad using API
async function generateAd(formData) {
    try {
        console.log('🚀 Sending request to /generate-ad with data:', formData);

        const response = await fetch('/generate-ad', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        console.log('📡 Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ HTTP error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ API Response received:', result);

        if (!result.success) {
            console.error('❌ API returned error:', result.error);
            throw new Error(result.error || 'Failed to generate ad');
        }

        return result;
    } catch (error) {
        console.error('❌ Ad generation error:', error);
        throw error;
    }
}

async function displayResults(result) {
    console.log('🖼️ Displaying results with:', {result});

    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) {
        console.error('Results div not found');
        return;
    }

    if (result && result.success) {
        const adText = result.ad_copy || 'Ad copy not available';
        const imageUrl = result.image_url || 'https://picsum.photos/600/400?random=1';

        console.log('📊 Final ad content being displayed:', {
            adText: adText.substring(0, 50) + '...',
            imageUrl: imageUrl.substring(0, 50) + '...'
        });

        resultsDiv.innerHTML = `
            <div class="ad-result">
                <h3>✨ Your AI-Generated Ad</h3>
                <div class="ad-content">
                    <div class="ad-image">
                        <img src="${imageUrl}" alt="Generated Ad Image" onerror="this.src='https://picsum.photos/600/400?random=fallback'">
                    </div>
                    <div class="ad-text">
                        <p style="margin: 8px 0; font-weight: 600; font-size: 1.05em; color: #333;">${adText}</p>
                    </div>
                </div>
                <div class="ad-actions">
                    <button onclick="downloadAd()" class="download-btn">📥 Download Ad</button>
                    <button onclick="copyAdText()" class="copy-btn">📋 Copy Text</button>
                    <button onclick="generateNewAd()" class="new-ad-btn">🔄 Generate Another</button>
                </div>
            </div>
        `;
    } else {
        resultsDiv.innerHTML = `
            <div class="error-message">
                <h3>❌ Error Generating Ad</h3>
                <p>${result?.error || 'Unknown error occurred'}</p>
                <button onclick="generateNewAd()" class="retry-btn">🔄 Try Again</button>
            </div>
        `;
    }
}

// Copy to clipboard
function copyAdText() {
    if (!currentAdData) {
        alert('No ad text to copy');
        return;
    }

    copyToClipboard(currentAdData, 'Ad text');
}

function copyToClipboard(text, type) {
    navigator.clipboard.writeText(text).then(() => {
        alert(`${type} copied to clipboard!`);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
    });
}

function formatAdText(text) {
    if (!text) return 'Generated ad text will appear here.';

    // Clean up the text
    let cleanText = text.trim();

    // Remove any existing HTML tags
    cleanText = cleanText.replace(/<[^>]*>/g, '');

    // Split into sentences
    const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);

    if (sentences.length <= 1) {
        return `<p style="margin: 8px 0; line-height: 1.5;">${cleanText}</p>`;
    }

    // Format with better structure
    const formatted = sentences.map((sentence, index) => {
        const trimmed = sentence.trim();
        if (index === 0) {
            // Main hook sentence
            return `<p style="margin: 8px 0; font-weight: 600; font-size: 1.05em; color: #333;">${trimmed}.</p>`;
        } else if (index === sentences.length - 1 && sentences.length > 2) {
            // Call to action sentence
            return `<p style="margin: 8px 0; font-style: italic; color: #667eea;">${trimmed}!</p>`;
        } else {
            // Supporting sentences
            return `<p style="margin: 8px 0; line-height: 1.5; color: #555;">${trimmed}.</p>`;
        }
    }).join('');

    return formatted;
}

function calculatePerformanceScore(result, formData) {
    let score = 70; // Base score

    // Assuming ad_copy contains both headline and ad text
    if (result && result.ad_copy) {
        const adTextWords = result.ad_copy.split(' ').length;
        if (adTextWords >= 15 && adTextWords <= 50) score += 15; // Adjust the word count range
    }

    if (formData.specialOffer && formData.specialOffer.trim()) score += 5;

    return Math.min(score, 100);
}

// Download image
function downloadImage() {
    if (!currentImageUrl) {
        alert('No image to download');
        return;
    }

    const formData = collectFormData();
    const filename = formData.productName ? formData.productName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'ad';

    const link = document.createElement('a');
    link.href = currentImageUrl;
    link.download = `${filename}_ad_image.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function regenerateAd() {
    const formData = collectFormData();
    if (validateFormData(formData)) {
        handleFormSubmission({ preventDefault: () => {} });
    }
}

function getFormData() {
    console.log('📋 Extracting form data...');

    const productName = document.getElementById('productName');
    const productDescription = document.getElementById('productDescription');
    const targetAudience = document.getElementById('targetAudience');
    const businessType = document.getElementById('businessType');
    const specialOffer = document.getElementById('specialOffer');
    const tone = document.getElementById('tone');
    const adFormat = document.getElementById('adFormat');
    const competitorUrl = document.getElementById('competitorUrl');

    // Get language from radio buttons
    const languageRadio = document.querySelector('input[name="language"]:checked');
    const language = languageRadio ? languageRadio.value : 'English';

    const formData = {
        productName: productName ? productName.value.trim() : '',
        productDescription: productDescription ? productDescription.value.trim() : '',
        targetAudience: targetAudience ? targetAudience.value.trim() : '',
        specialOffer: specialOffer ? specialOffer.value.trim() : '',
        language: language,
        tone: tone ? tone.value : 'professional',
        adFormat: adFormat ? adFormat.value : 'facebook-feed',
        businessType: businessType ? businessType.value : '',
        competitorUrl: competitorUrl ? competitorUrl.value.trim() : ''
    };

    console.log('📋 Form data extracted:', formData);
    return formData;
}

function showPaymentModal() {
    if (typeof window.showPaymentModal === 'function') {
        window.showPaymentModal();
    } else {
        alert('Payment functionality is currently unavailable. Please try again later.');
    }
}

// Add missing utility functions
function setLoading(isLoading) {
    if (isLoading) {
        showLoading();
    } else {
        hideLoading();
    }
}

// Close the script loading check
console.log('✅ Ad Generator script fully loaded');

// Ensure currentUser is available globally
if (typeof window.currentUser === 'undefined') {
    window.currentUser = null;
}

// Usage tracking functions
function checkUsageLimits() {
    const currentUser = typeof window.currentUser === 'function' ? window.currentUser() : null;

    if (currentUser) {
        // Check if user has premium subscription using canGenerateAd function
        return canGenerateAd();
    } else {
        showLoginRequiredModal();
        return false;
    }
}

function incrementUsageCount() {
    const currentUser = typeof window.currentUser === 'function' ? window.currentUser() : null;

    if (currentUser && typeof window.incrementAdUsage === 'function') {
        // Use Firebase-based increment function
        window.incrementAdUsage();
        console.log(`📊 Usage incremented via Firebase: ${currentUser.usageCount}/${currentUser.maxUsage} ads used`);

        // Check if limit reached
        if (currentUser.subscriptionStatus === 'free' && currentUser.usageCount >= 4) {
            console.log('🚫 Usage limit reached via Firebase, payment required');
            return true; // Indicates limit reached
        }
    }
    return false; // Limit not reached
}

function getAdFormatClass(adFormat) {
    switch(adFormat) {
        case 'instagram-story':
            return 'instagram-story-format';
        case 'google-search':
            return 'google-search-format';
        case 'whatsapp-status':
            return 'whatsapp-status-format';
        default:
            return 'facebook-format';
    }
}

function getFormatIcon(adFormat) {
    switch(adFormat) {
        case 'instagram-story':
            return '📸';
        case 'google-search':
            return '🔍';
        case 'whatsapp-status':
            return '💬';
        default:
            return '📘';
    }
}

function getFormatLabel(adFormat) {
    switch(adFormat) {
        case 'instagram-story':
            return 'Instagram Story';
        case 'google-search':
            return 'Ad';
        case 'whatsapp-status':
            return 'WhatsApp Status';
        default:
            return 'Sponsored';
    }
}

// Make functions globally available
window.handleFormSubmit = handleFormSubmission;
window.downloadImage = downloadImage;
window.regenerateAd = regenerateAd;
window.copyAdText = copyAdText;