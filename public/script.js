// Prevent multiple script loading
if (window.adGeneratorLoaded) {
    console.log('Ad Generator script already loaded, skipping...');
} else {
    window.adGeneratorLoaded = true;

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
                const hasDeepSeek = DEEPSEEK_API_KEY && DEEPSEEK_API_KEY.trim().length > 5;
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

    function setupEventListeners() {
        const form = document.getElementById('adForm');
        const generateButton = document.getElementById('generateButton');

        if (form) {
            form.addEventListener('submit', handleFormSubmission);
            console.log('✅ Form submit event listener attached');
        }

        if (generateButton) {
            generateButton.addEventListener('click', handleGenerateClick);
            console.log('✅ Generate button click event listener attached');
        }
    }

    function handleGenerateClick(event) {
        event.preventDefault();
        console.log('🖱️ Generate button clicked');
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

    async function handleFormSubmission(event) {
        event.preventDefault();

        // Wait for Firebase to initialize
        let retries = 0;
        while (typeof firebase === 'undefined' && retries < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }

        const user = typeof window.currentUser === 'function' ? window.currentUser() : null;

        console.log('🔍 Checking authentication status:', {
            user: !!user,
            firebase: typeof firebase !== 'undefined',
            auth: typeof firebase !== 'undefined' && !!firebase.auth
        });

        // Check if user is logged in
        if (!user) {
            console.log('🚫 User not authenticated, showing login modal');
            showLoginRequiredModal();
            return;
        }

        // Check if user has reached their limit BEFORE generating
        if (user && user.usageCount >= 4 && user.subscriptionStatus === 'free') {
            console.log('🚫 User has reached 4 ads limit, showing payment modal');
            showPaymentModal();
            return;
        }

        if (typeof window.canGenerateAd === 'function' && !window.canGenerateAd()) {
            console.log('🚫 canGenerateAd returned false, showing payment modal');
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
                // Display results first
                displayResults(result);

                // Save ad to Firebase
                if (user && typeof window.saveAd === 'function') {
                    try {
                        const adData = {
                            ...formData,
                            adCopy: result.ad_copy
                        };
                        await window.saveAd(adData, result.image_url);
                        console.log('✅ Ad saved to Firebase successfully');
                    } catch (saveError) {
                        console.error('Failed to save ad to Firebase:', saveError);
                    }
                }

                // Then increment usage count and check if limit reached
                if (user && typeof window.incrementAdUsage === 'function') {
                    const limitReached = window.incrementAdUsage();
                    console.log(`📊 Usage incremented, limit reached: ${limitReached}`);

                    // Show payment modal immediately when limit is reached (after 4th ad)
                    if (limitReached) {
                        setTimeout(() => {
                            console.log('💳 Showing payment modal after reaching limit');
                            showPaymentModal();
                        }, 3000);
                    }
                } else {
                    console.error('Firebase user tracking not available');
                    showError('User tracking not available. Please refresh the page.');
                }
            } else {
                showError(result.error || 'Failed to generate ad');
            }
        } catch (error) {
            console.error('Generation error:', error);
            showError('Network error. Please check your connection and try again.');
        }
    }

    function collectFormData() {
        const productName = document.getElementById('productName');
        const productDescription = document.getElementById('productDescription');
        const targetAudience = document.getElementById('targetAudience');
        const businessType = document.getElementById('businessType');
        const specialOffer = document.getElementById('specialOffer');
        const tone = document.getElementById('tone');
        const adFormat = document.getElementById('adFormat');
        const competitorUrl = document.getElementById('competitorUrl');

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
                    <h3 style="color: #e53e3e; margin-bottom: 15px; font-size: 1.5rem;">❌ Error</h3>
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

    async function generateAd(formData) {
        console.log('🚀 Starting ad generation...');

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
            const formData = collectFormData();
            const adFormat = formData.adFormat || 'facebook-feed';

            // Store current ad data
            currentAdData = adText;
            currentImageUrl = imageUrl;

            console.log('📊 Final ad content being displayed:', {
                adText: adText.substring(0, 50) + '...',
                imageUrl: imageUrl.substring(0, 50) + '...'
            });

            resultsDiv.innerHTML = `
                <div class="ad-result">
                    <h3>✨ Your Professional ${adFormat.charAt(0).toUpperCase() + adFormat.slice(1).replace('-', ' ')} Ad</h3>

                    <div class="ad-preview facebook-format">
                        <div class="ad-header">
                            <div class="profile-info">
                                <div class="profile-pic">${formData.productName ? formData.productName.charAt(0).toUpperCase() : 'B'}</div>
                                <div>
                                    <div class="page-name">${formData.productName || 'Your Business'}</div>
                                    <div class="sponsored">📘 Sponsored</div>
                                </div>
                            </div>
                        </div>

                        <div class="ad-content">
                            <div class="ad-text-section">
                                ${formatAdText(adText)}
                            </div>

                            <div class="ad-image-container">
                                <img src="${imageUrl}" alt="Professional Ad Image" class="ad-image" 
                                     onerror="this.src='https://picsum.photos/600/400?random=fallback'"
                                     oncontextmenu="return false;" ondragstart="return false;">
                            </div>

                            <div class="ad-cta-container">
                                <button class="ad-cta" disabled>Learn More</button>
                            </div>
                        </div>
                    </div>

                    <div class="ad-actions">
                        <button onclick="downloadAd()" class="action-btn download-btn">📥 Download</button>
                        <button onclick="copyAdText()" class="action-btn copy-btn">📋 Copy Text</button>
                        <button onclick="regenerateAd()" class="action-btn regenerate-btn">🔄 Regenerate</button>
                    </div>
                </div>
            `;
        } else {
            resultsDiv.innerHTML = `
                <div class="error-message">
                    <h3>❌ Error Generating Ad</h3>
                    <p>${result?.error || 'Unknown error occurred'}</p>
                    <button onclick="regenerateAd()" class="retry-btn">🔄 Try Again</button>
                </div>
            `;
        }
    }

    function formatAdText(text) {
        if (!text) return 'Generated ad text will appear here.';

        let cleanText = text.trim();
        cleanText = cleanText.replace(/<[^>]*>/g, '');

        const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);

        if (sentences.length <= 1) {
            return `<p style="margin: 8px 0; line-height: 1.5;">${cleanText}</p>`;
        }

        const formatted = sentences.map((sentence, index) => {
            const trimmed = sentence.trim();
            if (index === 0) {
                return `<p style="margin: 8px 0; font-weight: 600; font-size: 1.05em; color: #333;">${trimmed}.</p>`;
            } else if (index === sentences.length - 1 && sentences.length > 2) {
                return `<p style="margin: 8px 0; font-style: italic; color: #667eea;">${trimmed}!</p>`;
            } else {
                return `<p style="margin: 8px 0; line-height: 1.5; color: #555;">${trimmed}.</p>`;
            }
        }).join('');

        return formatted;
    }

    function copyAdText() {
        if (!currentAdData) {
            alert('No ad text to copy');
            return;
        }

        navigator.clipboard.writeText(currentAdData).then(() => {
            alert('Ad text copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy to clipboard');
        });
    }

    function downloadAd() {
        if (!currentImageUrl || !currentAdData) {
            alert('No ad to download');
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

        navigator.clipboard.writeText(currentAdData).then(() => {
            alert('🎉 Image download started and ad text copied to clipboard!');
        }).catch(() => {
            alert('🎉 Image download started!');
        });
    }

    function regenerateAd() {
        const formData = collectFormData();
        if (validateFormData(formData)) {
            handleFormSubmission({ preventDefault: () => {} });
        }
    }

    function showLoginRequiredModal() {
        console.log('🔑 Showing login required modal');

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
                background: rgba(0,0,0,0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.3s ease-out;
            `;

            modal.innerHTML = `
                <div style="
                    background: white;
                    padding: 40px;
                    border-radius: 20px;
                    text-align: center;
                    max-width: 500px;
                    margin: 20px;
                    box-shadow: 0 25px 70px rgba(0,0,0,0.4);
                    transform: scale(0.9);
                    animation: modalSlideIn 0.3s ease-out forwards;
                ">
                    <div style="font-size: 4rem; margin-bottom: 20px; animation: bounce 2s infinite;">🔐</div>
                    <h2 style="color: #333; margin-bottom: 15px; font-size: 1.8rem;">Sign In Required!</h2>
                    <p style="color: #666; font-size: 1.1rem; margin-bottom: 30px; line-height: 1.6;">
                        Please sign in to start generating amazing Facebook ads with AI!
                    </p>
                    <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="signInForMore()" style="
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            border: none;
                            padding: 18px 35px;
                            border-radius: 12px;
                            font-size: 1.1rem;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s ease;
                            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
                        ">🔑 Sign In as Guest</button>
                        <button onclick="closeLoginModal()" style="
                            background: #f8f9fa;
                            color: #666;
                            border: 2px solid #e9ecef;
                            padding: 18px 35px;
                            border-radius: 12px;
                            font-size: 1.1rem;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        ">Maybe Later</button>
                    </div>
                    <p style="color: #999; font-size: 0.9rem; margin-top: 20px;">
                        ✨ Get 4 free ads, then upgrade for unlimited access!
                    </p>
                </div>
                <style>
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes modalSlideIn {
                        from { transform: scale(0.9) translateY(-20px); opacity: 0; }
                        to { transform: scale(1) translateY(0); opacity: 1; }
                    }
                    @keyframes bounce {
                        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                        40% { transform: translateY(-10px); }
                        60% { transform: translateY(-5px); }
                    }
                </style>
            `;
            document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
    }

    function closeLoginModal() {
        const modal = document.getElementById('loginRequiredModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async function signInForMore() {
        console.log('🔑 Attempting to sign in...');

        if (typeof firebase === 'undefined') {
            console.error('Firebase not loaded');
            alert('Authentication service is loading. Please wait a moment and try again.');
            return;
        }

        if (typeof window.signIn === 'function') {
            try {
                await window.signIn();
                closeLoginModal();
            } catch (error) {
                console.error('Sign in error:', error);
                if (error.code === 'auth/popup-blocked') {
                    alert('Popup blocked! Please allow popups for this site and try again.');
                } else if (error.code === 'auth/popup-closed-by-user') {
                    console.log('User cancelled sign in');
                } else {
                    alert('Sign in failed. Please try again.');
                }
            }
        } else {
            console.error('signIn function not available');
            alert('Sign in functionality is not available. Please refresh the page and try again.');
        }
    }

    function showPaymentModal() {
        console.log('💳 Attempting to show payment modal...');

        if (typeof window.showPaymentModal === 'function') {
            window.showPaymentModal();
            return;
        }

        const upgradeMessage = `
    🚀 CONGRATULATIONS! 

    You've used all 4 FREE ads! 🎉

    Ready to unlock unlimited professional ads?

    💎 PRO PLAN - ₹599/month
    ✅ 100 Professional Ads
    ✅ Premium Templates  
    ✅ Priority Support

    ⭐ UNLIMITED PLAN - ₹999/month  
    ✅ Unlimited Ads
    ✅ All Premium Features
    ✅ 24/7 Support
    ✅ Custom Branding

    Transform your business with unlimited AI-powered ads!
        `;
        alert(upgradeMessage);
    }

    // Make functions globally available
    window.downloadAd = downloadAd;
    window.copyAdText = copyAdText;
    window.regenerateAd = regenerateAd;
    window.closeLoginModal = closeLoginModal;
    window.signInForMore = signInForMore;

    // Initialize the application
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🚀 App initializing...');

        setupEventListeners();
        setupLanguagePlaceholders();

        const configLoaded = loadConfig();
        if (configLoaded) {
            console.log('✅ Application initialized successfully');
        } else {
            console.error('❌ Failed to initialize application');
        }

        console.log('✅ App initialized');
    });

    console.log('✅ Ad Generator script fully loaded');
}