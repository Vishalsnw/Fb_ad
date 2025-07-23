
// API Configuration
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPAI_API_URL = 'https://api.deepai.org/api/text2img';

// Global variables
let currentAdData = null;
let currentImageUrl = null;
let isGenerating = false;

// Load configuration
let CONFIG = {};
let DEEPSEEK_API_KEY = '';
let DEEPAI_API_KEY = '';

async function loadConfig() {
    try {
        const timestamp = Date.now();
        const response = await fetch(`/config.js?t=${timestamp}`);
        const configScript = await response.text();

        // Execute the config script
        eval(configScript);

        DEEPSEEK_API_KEY = CONFIG.DEEPSEEK_API_KEY || '';
        DEEPAI_API_KEY = CONFIG.DEEPAI_API_KEY || '';

        console.log('✅ API keys loaded successfully');
        console.log('DEEPSEEK_API_KEY loaded:', !!DEEPSEEK_API_KEY);
        console.log('DEEPAI_API_KEY loaded:', !!DEEPAI_API_KEY);

        // Check if Razorpay keys are loaded
        if (!CONFIG.RAZORPAY_KEY_ID || !CONFIG.RAZORPAY_KEY_SECRET) {
            console.warn('⚠️ Razorpay keys not found in config');
        } else {
            console.log('✅ Razorpay keys loaded in main script');
        }

    } catch (error) {
        console.error('Failed to load config:', error);
        showError('Failed to load configuration. Please refresh the page.');
    }
}

// Load configuration when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadConfig();
    setupEventListeners();
    setupLanguagePlaceholders();
});

function setupEventListeners() {
    const form = document.getElementById('adForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadImage);
    }

    const regenerateBtn = document.getElementById('regenerateBtn');
    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', regenerateAd);
    }

	const copyBtn = document.querySelector('.copy-btn');
	if (copyBtn) {
		copyBtn.addEventListener('click', copyAdText);
	}

    const variationsBtn = document.getElementById('variationsBtn');
    if (variationsBtn) {
        variationsBtn.addEventListener('click', generateVariations);
    }
}

function setupLanguagePlaceholders() {
    const languageSelect = document.getElementById('language');
    const productNameInput = document.getElementById('productName');
    const productDescInput = document.getElementById('productDescription');
    const targetAudienceInput = document.getElementById('targetAudience');

    if (languageSelect) {
        languageSelect.addEventListener('change', function() {
            updatePlaceholders(this.value);
        });
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

async function handleFormSubmit(event) {
    event.preventDefault();

    const formData = getFormData();
    if (!validateForm(formData)) {
        return;
    }

    // Check if user is logged in
    if (!currentUser) {
        showLoginModal();
        return;
    }

    // Check if user can generate ads based on their plan
    if (!canGenerateAd()) {
        return;
    }

    if (!checkApiKeys()) return;

    showLoading();

    try {
        // Generate ad text first
        const textContent = await generateAdText(formData);

        // Generate image based on ad text
        const imageUrl = await generateAdImage(formData, textContent);

        // Display results
        displayResults(textContent, imageUrl, formData);

        // Save ad data
        currentAdData = {
            id: Date.now().toString(),
            formData: formData,
            textContent: textContent,
            imageUrl: imageUrl,
            timestamp: new Date().toISOString()
        };

        // Increment usage count
        incrementAdUsage();

        // Save to user's ad history if logged in
        if (window.currentUser) {
            saveAdToHistory(currentAdData);
        }

    } catch (error) {
        console.error('Error generating ad:', error);
        showError('Failed to generate ad: ' + error.message);
    } finally {
        hideLoading();
    }
}

function checkApiKeys() {
    if (!DEEPSEEK_API_KEY || !DEEPAI_API_KEY) {
        console.error('❌ API keys not loaded properly');
        showError('API keys not configured. Please set up your environment variables.');
        return false;
    }
    return true;
}

async function generateAdText(formData) {
    if (!DEEPSEEK_API_KEY) {
        throw new Error('DeepSeek API key not configured');
    }

    const prompt = createTextPrompt(formData);

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7
        })
    });

    if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse the response
    const lines = content.split('\n');
    const result = {};

    lines.forEach(line => {
        if (line.startsWith('HEADLINE:')) {
            result.headline = line.replace('HEADLINE:', '').trim();
        } else if (line.startsWith('AD_TEXT:')) {
            result.adText = line.replace('AD_TEXT:', '').trim();
        } else if (line.startsWith('CTA:')) {
            result.cta = line.replace('CTA:', '').trim();
        }
    });

    return result;
}

async function generateAdImage(formData, textContent) {
    if (!DEEPAI_API_KEY) {
        throw new Error('DeepAI API key not configured');
    }

    const imagePrompt = createImagePromptFromAdText(formData, textContent);

    const formDataObj = new FormData();
    formDataObj.append('text', imagePrompt);

    const response = await fetch('https://api.deepai.org/api/text2img', {
        method: 'POST',
        headers: {
            'Api-Key': DEEPAI_API_KEY
        },
        body: formDataObj
    });

    if (!response.ok) {
        throw new Error(`DeepAI API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.output_url) {
        throw new Error('No image URL returned from DeepAI');
    }

    return data.output_url;
}

function createTextPrompt(formData) {
    return `Create a compelling ${formData.adFormat} advertisement in ${formData.language} with a ${formData.tone} tone.

Product Name: ${formData.productName}
Product/Service: ${formData.productDescription}
Target Audience: ${formData.targetAudience}
Business Type: ${formData.businessType || 'General'}
Special Offer: ${formData.specialOffer || 'None'}

Please format the response as:
HEADLINE: [Catchy headline]
AD_TEXT: [Main ad copy]
CTA: [Call to action]`;
}

function createImagePromptFromAdText(formData, textContent) {
    const productName = formData.productName || 'product';
    const productDescription = formData.productDescription || '';
    const businessType = formData.businessType || 'business';
    const adFormat = formData.adFormat || 'facebook-feed';

    // Extract key elements from the generated ad text
    const headline = (textContent.headline || '').toLowerCase();
    const adText = (textContent.adText || '').toLowerCase();
    const fullText = `${headline} ${adText}`;

    let productVisuals = '';
    let moodKeywords = '';
    let settingElements = '';
    let brandNameOverlay = '';

    // Enhanced product detection
    const productInfo = `${productName} ${productDescription}`.toLowerCase();

    if (productInfo.includes('agarbatti') || productInfo.includes('incense')) {
        productVisuals = `premium ${productName} incense sticks package, traditional agarbatti bundle, elegant Indian packaging design`;
        settingElements = 'sacred temple setting, soft golden lighting, spiritual atmosphere, Sanskrit symbols, traditional Indian elements';
        brandNameOverlay = `clear "${productName}" brand name on product label, professional product branding, visible text on packaging`;

        if (fullText.includes('peace') || fullText.includes('calm') || fullText.includes('tranquil') || fullText.includes('serenity')) {
            moodKeywords = 'peaceful zen atmosphere, soft warm lighting, meditative ambiance, calming colors';
        } else if (fullText.includes('divine') || fullText.includes('spiritual') || fullText.includes('blessing') || fullText.includes('sacred')) {
            moodKeywords = 'divine golden light, spiritual energy, sacred blessing aura, heavenly atmosphere';
        } else if (fullText.includes('home') || fullText.includes('family') || fullText.includes('love') || fullText.includes('heart')) {
            moodKeywords = 'warm family home, loving atmosphere, cozy indoor setting, emotional warmth';
        } else {
            moodKeywords = 'traditional spiritual setting, warm golden tones, peaceful atmosphere';
        }
    } else if (productInfo.includes('gel') && businessType === 'Healthcare') {
        productVisuals = `elegant ${productName} gel bottle, modern cosmetic packaging, health and beauty product`;
        settingElements = 'clean spa-like setting, white marble background, professional beauty studio';
        brandNameOverlay = `clear "${productName}" brand name on product label, professional product branding, visible text on packaging`;

        if (fullText.includes('confidence') || fullText.includes('beauty') || fullText.includes('radiant')) {
            moodKeywords = 'confident beauty, glowing skin, radiant appearance, elegant sophistication';
        } else if (fullText.includes('growth') || fullText.includes('hair')) {
            moodKeywords = 'healthy hair growth, natural beauty, feminine confidence, wellness focused';
        } else {
            moodKeywords = 'clean modern healthcare, professional beauty, wellness atmosphere';
        }
    } else {
        // Generic product handling
        productVisuals = `${productName} product, professional ${businessType} packaging, commercial quality display`;
        settingElements = 'clean modern background, professional studio lighting, commercial photography setup';
        brandNameOverlay = `prominent "${productName}" brand name clearly visible, professional product labeling, readable brand text`;
        moodKeywords = 'professional commercial style, modern design, clean aesthetic, marketing ready';
    }

    // Build comprehensive prompt with brand name emphasis
    const detailedPrompt = `Professional ${adFormat} advertisement photograph: ${productVisuals} with ${brandNameOverlay}. Setting: ${settingElements}. Mood and style: ${moodKeywords}. High-resolution commercial photography, professional advertising quality, clear brand name visible, modern commercial design, clean background, product focused, high quality, marketing ready, ${formData.adFormat} format`;

    return detailedPrompt;
}

function displayResults(textContent, imageUrl, formData) {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;

    currentImageUrl = imageUrl;
    currentAdData = textContent;
    const performanceScore = calculatePerformanceScore(textContent, formData);

    resultsDiv.innerHTML = `
        <div class="ad-preview">
            <div class="ad-image-container">
                <img src="${imageUrl}" alt="Generated Ad" class="ad-image" />
            </div>
            <div class="ad-content">
                <h3 class="ad-headline">${textContent.headline || 'Generated Headline'}</h3>
                <p class="ad-text">${textContent.adText || 'Generated ad text will appear here.'}</p>
                <div class="ad-cta">
                    <button class="cta-button">${textContent.cta || 'Learn More'}</button>
                </div>
            </div>
        </div>
        <div class="ad-stats">
            <div class="performance-score">
                <span class="score-label">Performance Score:</span>
                <span class="score-value">${performanceScore}/100</span>
            </div>
        </div>
        <div class="ad-actions">
            <button id="downloadBtn" class="action-btn download-btn">Download Image</button>
			<button class="copy-btn">Copy Text</button>
            <button id="regenerateBtn" class="action-btn regenerate-btn">Regenerate</button>
        </div>
    `;

    // Re-attach event listeners
    document.getElementById('downloadBtn').addEventListener('click', downloadImage);
    document.getElementById('regenerateBtn').addEventListener('click', regenerateAd);
	document.querySelector('.copy-btn').addEventListener('click', copyAdText);

    resultsDiv.style.display = 'block';
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

function calculatePerformanceScore(textContent, formData) {
    let score = 70; // Base score

    if (textContent.headline) {
        const headlineWords = textContent.headline.split(' ').length;
        if (headlineWords >= 5 && headlineWords <= 10) score += 5;
    }

    if (textContent.adText && textContent.adText.length > 50) score += 10;
    if (textContent.cta && textContent.cta.length > 0) score += 10;
    if (formData.specialOffer && formData.specialOffer.trim()) score += 5;

    return Math.min(score, 100);
}

async function downloadImage() {
    if (!currentImageUrl) {
        alert('No image to download');
        return;
    }

    try {
        const response = await fetch(currentImageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `facebook-ad-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('❌ Download failed:', error);
        alert('Failed to download image. Please try right-clicking on the image and selecting "Save image as..."');
    }
}

function regenerateAd() {
    const formData = getFormData();
    if (validateForm(formData)) {
        handleFormSubmit({ preventDefault: () => {} });
    }
}

function getFormData() {
    const productName = document.getElementById('productName');
    const productDescription = document.getElementById('productDescription');
    const targetAudience = document.getElementById('targetAudience');
    const businessType = document.getElementById('businessType');
    const specialOffer = document.getElementById('specialOffer');
    const language = document.getElementById('language');
    const tone = document.getElementById('tone');
    const adFormat = document.getElementById('adFormat');

    return {
        productName: productName ? productName.value : '',
        productDescription: productDescription ? productDescription.value : '',
        targetAudience: targetAudience ? targetAudience.value : '',
        specialOffer: specialOffer ? specialOffer.value : '',
        language: language ? language.value : 'English',
        tone: tone ? tone.value : 'professional',
        adFormat: adFormat ? adFormat.value : 'facebook-feed',
        businessType: businessType ? businessType.value : ''
    };
}

function validateForm(formData) {
    if (!formData.productName.trim()) {
        showError('Please enter your product name');
        return false;
    }
    if (!formData.productDescription.trim()) {
        showError('Please describe your product or service');
        return false;
    }
    if (!formData.targetAudience.trim()) {
        showError('Please specify your target audience');
        return false;
    }
    return true;
}

function showLoading() {
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Generating your Facebook ad...</p>
            </div>
        `;
        resultsDiv.style.display = 'block';
    }
}

function hideLoading() {
    // Loading will be replaced by results or error message
}

function showError(message) {
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.innerHTML = `
            <div class="error-message">
                <h3>❌ Error</h3>
                <p>${message}</p>
                <button onclick="location.reload()" class="retry-btn">Try Again</button>
            </div>
        `;
        resultsDiv.style.display = 'block';
    }
    console.error('Error:', message);
}

function saveAdToHistory(adData) {
    try {
        // Save to server if user is logged in
        if (window.currentUser) {
            fetch('/save-ad', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...adData,
                    userId: window.currentUser.uid
                })
            }).catch(error => {
                console.error('Failed to save ad to server:', error);
            });
        }

        // Also save locally
        const savedAds = JSON.parse(localStorage.getItem('savedAds') || '[]');
        savedAds.unshift(adData);

        // Keep only last 50 ads
        if (savedAds.length > 50) {
            savedAds.splice(50);
        }

        localStorage.setItem('savedAds', JSON.stringify(savedAds));
    } catch (error) {
        console.error('Failed to save ad:', error);
    }
}

function copyAdText() {
    if (!currentAdData) return;

    const textToCopy = `${currentAdData.headline}\n\n${currentAdData.adText}\n\n${currentAdData.cta}`;

    navigator.clipboard.writeText(textToCopy).then(() => {
        const btn = document.querySelector('.copy-btn');
        const originalText = btn.textContent;
        btn.textContent = '✅ Copied!';
        btn.style.background = '#28a745';

        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy text. Please try again.');
    });
}

function generateVariations() {
    if (!currentAdData) {
        alert('Please generate an ad first!');
        return;
    }

    const formData = getFormData();
    if (!validateForm(formData)) return;

    console.log('🔄 Generating ad variations...');
    setLoading(true);

    const variations = [
        { ...formData, tone: 'Energetic' },
        { ...formData, tone: 'Emotional' },
        { ...formData, tone: 'Funny' }
    ];

    Promise.all(variations.map(async (variation, index) => {
        try {
            const textContent = await generateAdText(variation);
            return {
                title: `Variation ${index + 1} (${variation.tone})`,
                content: textContent
            };
        } catch (error) {
            console.error(`Failed to generate variation ${index + 1}:`, error);
            return null;
        }
    })).then(results => {
        const validResults = results.filter(r => r !== null);
        displayVariations(validResults);
    }).finally(() => {
        setLoading(false);
    });
}

function displayVariations(variations) {
    let container = document.getElementById('variationsContainer');
    if (!container) {
        const resultSection = document.querySelector('.result-section');
        container = document.createElement('div');
        container.id = 'variationsContainer';
        resultSection.appendChild(container);
    }

    container.innerHTML = '<h3 style="margin: 20px 0 15px 0; color: #333;">Alternative Versions</h3>';

    variations.forEach(variation => {
        const variationCard = document.createElement('div');
        variationCard.className = 'variation-card';
        variationCard.style.cssText = 'border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px; background: #f9f9f9;';
        variationCard.innerHTML = `
            <h4>${variation.title}</h4>
            <p><strong>Headline:</strong> ${variation.content.headline}</p>
            <p><strong>Text:</strong> ${variation.content.adText}</p>
            <p><strong>CTA:</strong> ${variation.content.cta}</p>
            <button onclick="useVariation(${JSON.stringify(variation.content).replace(/"/g, '&quot;')})" 
                    style="background: #667eea; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                Use This Version
            </button>
        `;
        container.appendChild(variationCard);
    });
}

function useVariation(variationContent) {
    currentAdData = variationContent;
    const formData = getFormData();
    updateAdPreview(variationContent, currentImageUrl, formData.adFormat);

    document.querySelector('.ad-preview').scrollIntoView({ behavior: 'smooth' });
}

function updateAdPreview(textContent, imageUrl, adFormat) {
    const adPreview = document.querySelector('.ad-preview');

    updatePreviewHeading(adFormat);

    const imageContainer = document.getElementById('imageContainer');
    const adImage = document.getElementById('adImage');
    const downloadBtn = document.getElementById('downloadBtn');

    if (imageUrl) {
        adImage.src = imageUrl;
        imageContainer.style.display = 'block';
        downloadBtn.style.display = 'inline-block';
    } else {
        imageContainer.style.display = 'none';
        downloadBtn.style.display = 'none';
    }

    switch(adFormat) {
        case 'facebook-feed':
            updateFacebookPreview(textContent);
            break;
        case 'instagram-story':
            updateInstagramStoryPreview(textContent);
            break;
        case 'google-search':
            updateGoogleSearchPreview(textContent);
            break;
        case 'whatsapp-status':
            updateWhatsAppStatusPreview(textContent);
            break;
        default:
            updateFacebookPreview(textContent);
    }
}

function updatePreviewHeading(adFormat) {
    const resultHeading = document.querySelector('.result-section h2');
    if (resultHeading) {
        const headings = {
            'facebook-feed': '📱 Your Facebook Ad',
            'instagram-story': '📸 Your Instagram Story',
            'google-search': '🔍 Your Google Search Ad',
            'whatsapp-status': '💬 Your WhatsApp Status Ad'
        };
        resultHeading.textContent = headings[adFormat] || '📱 Your Facebook Ad';
    }
}

function updateFacebookPreview(textContent) {
    const headlineEl = document.getElementById('adHeadline');
    const textEl = document.getElementById('adText');
    const ctaEl = document.getElementById('adCta');
    const hashtagsEl = document.getElementById('adHashtags');

    if (headlineEl) headlineEl.textContent = textContent.headline || 'No headline generated';
    if (textEl) textEl.textContent = textContent.adText || 'No ad text generated';
    if (ctaEl) ctaEl.textContent = textContent.cta || 'No CTA generated';
    if (hashtagsEl) hashtagsEl.textContent = '';
}

function updateInstagramStoryPreview(textContent) {
    updateFacebookPreview(textContent);
	const adPreview = document.querySelector('.ad-preview');
    adPreview.className = 'ad-preview instagram-story-format';
}

function updateGoogleSearchPreview(textContent) {
    updateFacebookPreview(textContent);
	const adPreview = document.querySelector('.ad-preview');
    adPreview.className = 'ad-preview google-search-format';
}

function updateWhatsAppStatusPreview(textContent) {
    updateFacebookPreview(textContent);
	const adPreview = document.querySelector('.ad-preview');
    adPreview.className = 'ad-preview whatsapp-status-format';
}
