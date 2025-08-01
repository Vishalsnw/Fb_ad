// Global error handlers
window.addEventListener('unhandledrejection', function(event) {
    console.error('❌ Unhandled promise rejection:', event.reason);
    console.error('❌ Promise that was rejected:', event.promise);
});

window.addEventListener('error', function(event) {
    console.error('❌ Global error:', event.error);
});

// Prevent multiple script loading
if (window.adGeneratorLoaded || window.scriptInitialized) {
    console.log('Ad Generator script already loaded, skipping...');
} else {
    window.adGeneratorLoaded = true;
    window.scriptInitialized = true;

    // Global variables
    let adsUsed = 0;
    let currentAdData = null;
    let currentImageUrl = null;

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
        console.log('🔧 Setting up event listeners...');

        const form = document.getElementById('adForm');
        const generateButton = document.getElementById('generateButton');

        console.log('🔍 Form element found:', !!form);
        console.log('🔍 Generate button found:', !!generateButton);

        if (form) {
            // Remove existing listeners to prevent duplicates
            form.removeEventListener('submit', handleFormSubmission);
            form.addEventListener('submit', handleFormSubmission);
            console.log('✅ Form submit event listener attached');
        } else {
            console.error('❌ Form element with ID "adFoconsole.error('❌ Generate form not found');
        }

        if (generateButton) {
            // Remove existing listeners to prevent duplicates
            generateButton.removeEventListener('click', handleGenerateClick);
            generateButton.addEventListener('click', handleGenerateClick);
            console.log('✅ Generate button click event listener attached');
        } else {
            console.error('❌ Generate button with ID "generateButton" not found');
        }

        // Also try to attach to any button with class "generate-btn"
        const generateBtns = document.querySelectorAll('.generate-btn');
        generateBtns.forEach((btn, index) => {
            btn.removeEventListener('click', handleGenerateClick);
            btn.addEventListener('click', handleGenerateClick);
            console.log(`✅ Generate button ${index + 1} event listener attached`);
        });
    }

    function handleGenerateClick(event) {
        event.preventDefault();
        console.log('🖱️ Generate button clicked');

        // Create a synthetic form submission event
        const syntheticEvent = {
            preventDefault: () => {},
            target: event.target.closest('form') || document.getElementById('adForm')
        };

        handleFormSubmission(syntheticEvent);
    }

    function setupLanguagePlaceholders() {
        const languageRadios = documentent.querySelectorAll('input[name="language"]');

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
        console.log('🚀 Form submission started');

        try {
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
                auth: typeof firebase !== 'undefined' && !!firebase.auth,
                currentUserFunction: typeof window.currentUser,
                userData: user ? { uid: user.uid, usageCount: user.usageCount, subscriptionStatus: user.subscriptionStatus } : null
            });

            console.log('🔍 Full user object:', user);

        // Check if user is logged in
        if (!user) {
            console.log('🚫 User not authenticated, showing login modal');
            showLoginRequiredModal();
            return;
        }

        // Get fresh user data from Firebase before checking limits
        const freshUser = await loadFreshUserData();
        const currentUsage = freshUser ? freshUser.usageCount : 0;
        const maxUsage = freshUser ? freshUser.maxUsage || 4 : 4;
        const subscriptionStatus = freshUser ? freshUser.subscriptionStatus || 'free' : 'free';
        
        console.log(`🔍 Fresh user data - Usage: ${currentUsage}/${maxUsage}, Plan: ${subscriptionStatus}`);

        // Check if user has reached their limit BEFORE generating
        if (currentUsage >= maxUsage && subscriptionStatus === 'free') {
            console.log(`🚫 User has reached ${maxUsage} ads limit (${currentUsage} used), showing payment modal`);
            showPaymentModal();
            return;
        }

        // Check if user can generate more ads
        if (!canGenerateAd()) {
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
            console.log('🚀 Starting ad generation process...');

            // Set a timeout for the request
            const timeoutId = setTimeout(() => {
                console.warn('⚠️ Ad generation taking longer than expected...');
            }, 10000);

            // Generate the ad
            const result = await generateAd(formData);
            clearTimeout(timeoutId);

            console.log('✅ Ad generation completed, result:', result);

            if (result && result.success) {
                console.log('🎨 Displaying results...');
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
                    try {
                        const limitReached = await window.incrementAdUsage();
                        console.log(`📊 Usage incremented, limit reached: ${limitReached}`);
                        
                        // Update user object with new usage count
                        const updatedUser = typeof window.currentUser === 'function' ? window.currentUser() : null;
                        if (updatedUser) {
                            console.log(`📊 Updated usage count: ${updatedUser.usageCount}/${updatedUser.maxUsage || 4}`);
                        }

                        // Show payment modal immediately when limit is reached (after 4th ad)
                        if (limitReached) {
                            setTimeout(() => {
                                console.log('💳 Showing payment modal after reaching limit');
                                if (typeof window.showPaymentModal === 'function') {
                                    window.showPaymentModal();
                                } else {
                                    console.error('❌ showPaymentModal function not available after limit reached');
                                    alert('🎉 CONGRATULATIONS! You\'ve reached your 4 FREE ads limit!\n\n💎 PRO PLAN - ₹599/month\n✅ 100 Professional Ads\n✅ Premium Templates\n✅ Priority Support\n\n⭐ UNLIMITED PLAN - ₹999/month\n✅ Unlimited Ads\n✅ All Premium Features\n✅ 24/7 Support\n\nRefresh the page to upgrade!');
                                }
                            }, 2000); // Show after 2 seconds to let user see the ad
                        }
                    } catch (usageError) {
                        console.error('❌ Error incrementing usage:', usageError);
                        // Still allow the ad to be generated, but warn user
                        console.warn('⚠️ Usage tracking failed, but ad was generated successfully');
                    }
                } else {
                    console.error('❌ incrementAdUsage function not available');
                    console.warn('⚠️ Usage tracking not available, but ad generated successfully');
                }
            } else {
                console.error('❌ Invalid result structure:', result);
                showError(result?.error || 'Failed to generate ad - invalid response');
            }
        } catch (error) {
            console.error('❌ Generation error:', error);
            console.error('❌ Error type:', typeof error);
            console.error('❌ Error stack:', error.stack);

            let errorMessage = 'Network error. Please check your connection and try again.';
            if (error.message) {
                errorMessage = error.message;
            }

            showError(errorMessage);
        }
    } catch (mainError) {
        console.error('❌ Main form submission error:', mainError);
        console.error('❌ Main error stack:', mainError.stack);
        showError('An unexpected error occurred. Please refresh the page and try again.');
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
            console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ HTTP error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const responseText = await response.text();
            console.log('📡 Raw response text:', responseText.substring(0, 200) + '...');

            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('❌ Failed to parse JSON response:', parseError);
                console.error('❌ Response text:', responseText);
                throw new Error('Invalid JSON response from server');
            }

            console.log('✅ API Response received:', result);

            if (!result.success) {
                console.error('❌ API returned error:', result.error);
                throw new Error(result.error || 'Failed to generate ad');
            }

            return result;
        } catch (error) {
            console.error('❌ Ad generation error:', error);
            console.error('❌ Error stack:', error.stack);
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
                            background: white;
                            color: #333;
                            border: 2px solid #dadce0;
                            padding: 16px 30px;
                            border-radius: 12px;
                            font-size: 1.1rem;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s ease;
                            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 10px;
                            min-width: 240px;
                        " onmouseover="this.style.borderColor='#4285f4'; this.style.boxShadow='0 6px 20px rgba(0,0,0,0.15)'" onmouseout="this.style.borderColor='#dadce0'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.1)'">
                            <svg width="18" height="18" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Continue with Google
                        </button>
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
        ```text

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

    function canGenerateAd() {
        const currentUser = typeof window.currentUser === 'function' ? window.currentUser() : null;
        if (!currentUser) {
            console.log('🚫 No user logged in');
            return false; // Anonymous users handled separately
        }

        const userPlan = currentUser.subscriptionStatus || 'free';
        const adsUsed = currentUser.usageCount || 0;
        const maxUsage = 4; // Fixed limit for free users

        console.log(`🔍 Checking generation limits: plan=${userPlan}, adsUsed=${adsUsed}, maxUsage=${maxUsage}`);

        // For premium/unlimited users (allow unlimited generation)
        if (userPlan === 'premium' || userPlan === 'pro' || userPlan === 'unlimited') {
            console.log('✅ Premium plan, allowing generation');
            return true;
        }

        // For free users, check if they've reached their 4 ad limit BEFORE generating
        if (adsUsed >= maxUsage && userPlan === 'free') {
            console.log(`🚫 User has reached free plan limit (${adsUsed}/${maxUsage} ads), showing payment modal`);
            showPaymentModal();
            return false;
        }

        console.log(`✅ Can generate: ${adsUsed}/${maxUsage} ads used (free plan)`);
        return true;
    }

    // Add debug function for testing
    window.testGenerate = function() {
        console.log('🧪 Test generate function called');
        const formData = collectFormData();
        console.log('🧪 Form data:', formData);
        if (validateFormData(formData)) {
            console.log('✅ Form data is valid');
            handleFormSubmission({ preventDefault: () => {} });
        } else {
            console.log('❌ Form data is invalid');
        }
    };

    // Function to load fresh user data from Firebase 
    async function loadFreshUserData() {
        try {
            const currentUser = typeof window.currentUser === 'function' ? window.currentUser() : null;
            if (!currentUser) return null;

            // Force reload from Firebase to get latest data
            if (window.db && typeof window.db.collection === 'function') {
                const userDoc = await window.db.collection('users').doc(currentUser.uid).get();
                if (userDoc.exists) {
                    const freshData = userDoc.data();
                    // Update the current user object with fresh data
                    Object.assign(currentUser, freshData);
                    console.log(`📊 Fresh user data loaded: ${freshData.usageCount || 0} ads used, plan: ${freshData.subscriptionStatus || 'free'}`);
                    return currentUser;
                }
            }
            return currentUser;
        } catch (error) {
            console.error('❌ Failed to load fresh user data:', error);
            // Return current user object as fallback
            return typeof window.currentUser === 'function' ? window.currentUser() : null;
        }
    }

    // Add direct API test function
    window.testAPI = async function() {
        console.log('🧪 Testing API directly...');
        try {
            const testData = {
                productName: 'Test Product',
                productDescription: 'Test description',
                targetAudience: 'Test audience',
                language: 'English',
                tone: 'professional',
                adFormat: 'facebook-feed'
            };

            const result = await generateAd(testData);
            console.log('🧪 Direct API test result:', result);

            if (result.success) {
                displayResults(result);
            }
        } catch (error) {
            console.error('🧪 Direct API test failed:', error);
        }
    };

    // Add usage testing function
    window.testUsage = async function() {
        console.log('🧪 Testing usage tracking...');
        const user = typeof window.currentUser === 'function' ? window.currentUser() : null;
        
        if (!user) {
            console.log('❌ No user logged in');
            return;
        }

        console.log('👤 Current user:', {
            uid: user.uid,
            usageCount: user.usageCount,
            maxUsage: user.maxUsage,
            subscriptionStatus: user.subscriptionStatus
        });

        if (typeof window.incrementAdUsage === 'function') {
            console.log('🧪 Testing incrementAdUsage...');
            const limitReached = await window.incrementAdUsage();
            console.log('🧪 Limit reached:', limitReached);
            
            if (limitReached) {
                console.log('🧪 Should show payment modal...');
                showPaymentModal();
            }
        } else {
            console.error('❌ incrementAdUsage function not available');
        }
    };

    // Add function to reset usage for testing
    window.resetUsage = async function() {
        const user = typeof window.currentUser === 'function' ? window.currentUser() : null;
        if (!user) {
            console.log('❌ No user logged in');
            return;
        }

        if (window.db) {
            try {
                await window.db.collection('users').doc(user.uid).update({
                    usageCount: 0
                });
                user.usageCount = 0;
                console.log('✅ Usage count reset to 0');
                updateUsageCounter();
            } catch (error) {
                console.error('❌ Failed to reset usage:', error);
            }
        }
    };

    // Make functions globally available
    window.downloadAd = downloadAd;
    window.copyAdText = copyAdText;
    window.regenerateAd = regenerateAd;
    window.closeLoginModal = closeLoginModal;
    window.signInForMore = signInForMore;

    // Initialize the application
    async function initializeApp() {
        console.log('🚀 App initializing...');

        try {
            // Load config first
            const configLoaded = await loadConfig();
            if (!configLoaded) {
                console.error('❌ Failed to load config');
                return;
            }

            // Setup event listeners after config is loaded
            setupEventListeners();
            setupLanguagePlaceholders();

            console.log('✅ Application initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }

    console.log('✅ Ad Generator script fully loaded');
}