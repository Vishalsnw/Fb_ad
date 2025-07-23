// API Configuration
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
let DEEPSEEK_API_KEY = '';
let DEEPAI_API_KEY = '';

// Global variables
let currentAdData = null;
let currentImageUrl = null;

// Load configuration when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadConfig();
    setupEventListeners();
    setupLanguagePlaceholders();
});

function loadConfig() {
    const script = document.createElement('script');
    script.src = window.location.origin + '/config.js?t=' + Date.now();

    script.onload = function() {
        if (window.CONFIG) {
            DEEPSEEK_API_KEY = window.CONFIG.DEEPSEEK_API_KEY;
            DEEPAI_API_KEY = window.CONFIG.DEEPAI_API_KEY;

            console.log('✅ API keys loaded successfully');
            console.log('DEEPSEEK_API_KEY loaded:', !!DEEPSEEK_API_KEY);
            console.log('DEEPAI_API_KEY loaded:', !!DEEPAI_API_KEY);

            if (!DEEPSEEK_API_KEY || !DEEPAI_API_KEY) {
                console.warn('⚠️ Some API keys are missing!');
                showError('API keys not configured. Please add them in Replit Secrets.');
            }
        } else {
            console.error('❌ CONFIG object not found');
            showError('Failed to load configuration');
        }
    };

    script.onerror = function() {
        console.error('❌ Failed to load config.js');
        showError('Failed to load configuration');
    };

    document.head.appendChild(script);
}

function setupEventListeners() {
    const form = document.getElementById('adForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // Add other event listeners as needed
    const variationsBtn = document.getElementById('variationsBtn');
    if (variationsBtn) {
        variationsBtn.addEventListener('click', generateVariations);
    }

	const copyBtn = document.querySelector('.copy-btn');
	if (copyBtn) {
		copyBtn.addEventListener('click', copyAdText);
	}

	const downloadBtn = document.getElementById('downloadBtn');
	if (downloadBtn) {
		downloadBtn.addEventListener('click', downloadImage);
	}

	const regenerateBtn = document.getElementById('regenerateBtn');
	if (regenerateBtn) {
		regenerateBtn.addEventListener('click', regenerateAd);
	}
}

function setupLanguagePlaceholders() {
    const languageInputs = document.querySelectorAll('input[name="language"]');

    languageInputs.forEach(input => {
        input.addEventListener('change', function() {
            updatePlaceholderText(this.value);
        });
    });
}

function updatePlaceholderText(language) {
    const placeholders = {
        'English': 'Describe your product or service...',
        'Hindi': 'अपने उत्पाद या सेवा का वर्णन करें...',
        'spanish': 'Describe tu producto o servicio...',
        'french': 'Décrivez votre produit ou service...'
    };

    const textarea = document.getElementById('productDescription');
    if (textarea && placeholders[language]) {
        textarea.placeholder = placeholders[language];
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

function getFormData() {
    const productName = document.getElementById('productName');
    const productDesc = document.getElementById('productDescription');
    const targetAud = document.getElementById('targetAudience');
    const adFormat = document.getElementById('adFormat');
    const tone = document.getElementById('tone');
    const competitorUrl = document.getElementById('competitorUrl');
    const businessType = document.getElementById('businessType');
    const selectedLanguage = document.querySelector('input[name="language"]:checked');
    
    return {
        productName: productName ? productName.value : '',
        productDescription: productDesc ? productDesc.value : '',
        targetAudience: targetAud ? targetAud.value : '',
        language: selectedLanguage ? selectedLanguage.value : 'English',
        adFormat: adFormat ? adFormat.value : 'facebook-feed',
        tone: tone ? tone.value : 'Professional',
        specialOffer: '',
        competitorUrl: competitorUrl ? competitorUrl.value : '',
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

function handleFormSubmit(event) {
    event.preventDefault();

    const formData = getFormData();
    if (!validateForm(formData)) return;

    if (!checkApiKeys()) return;

    console.log('🚀 Starting ad generation...');
    console.log('Form data:', formData);

    setLoading(true);

    // Generate text first, then use it to create better image
    generateAdText(formData).then(textResult => {
        console.log('✅ Text generation completed');
        
        // Generate image using the actual ad content
        generateImageFromAdText(formData, textResult).then(imageResult => {
            console.log('✅ Image generation completed');
            displayResults(textResult, imageResult);
            setLoading(false);
        }).catch(imageError => {
            console.warn('⚠️ Image generation failed:', imageError);
            // Still display results with text only
            displayResults(textResult, null);
            setLoading(false);
            showError('Ad text generated successfully, but image generation failed. You can still use the text content.');
        });
        
    }).catch(error => {
        console.error('❌ Text generation failed:', error);
        showError(`Failed to generate ad text: ${error.message}`);
        setLoading(false);
    });
}

async function generateAdText(formData) {
    const prompt = createTextPrompt(formData);
    console.log('🔗 Making request to DeepSeek API...');

    try {
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
                max_tokens: 500,
                temperature: 0.7
            })
        });

        console.log('📡 DeepSeek API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('DeepSeek API error response:', errorText);
            throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('📋 DeepSeek API response data:', data);

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from DeepSeek API');
        }

        const content = data.choices[0].message.content;
        return parseAdContent(content);

    } catch (error) {
        console.error('❌ DeepSeek API request failed:', error);
        throw error;
    }
}

async function generateImage(formData) {
    console.log('🖼️ Generating image with DeepAI...');

    if (!DEEPAI_API_KEY) {
        throw new Error('DeepAI API key not found');
    }

    const imagePrompt = createImagePrompt(formData);
    console.log('🎨 Image prompt:', imagePrompt);

    const formDataToSend = new FormData();
    formDataToSend.append('text', imagePrompt);

    const response = await fetch('https://api.deepai.org/api/text2img', {
        method: 'POST',
        headers: {
            'Api-Key': DEEPAI_API_KEY
        },
        body: formDataToSend
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ DeepAI API error:', errorText);
        throw new Error(`DeepAI API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ DeepAI response:', data);

    if (!data.output_url) {
        throw new Error('No image URL returned from DeepAI');
    }

    return data.output_url;
}

async function generateImageFromAdText(formData, adTextContent) {
    console.log('🖼️ Generating image based on ad content with DeepAI...');

    if (!DEEPAI_API_KEY) {
        throw new Error('DeepAI API key not found');
    }

    const imagePrompt = createImagePromptFromAdText(formData, adTextContent);
    console.log('🎨 Enhanced image prompt:', imagePrompt);

    const formDataToSend = new FormData();
    formDataToSend.append('text', imagePrompt);

    const response = await fetch('https://api.deepai.org/api/text2img', {
        method: 'POST',
        headers: {
            'Api-Key': DEEPAI_API_KEY
        },
        body: formDataToSend
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ DeepAI API error:', errorText);
        throw new Error(`DeepAI API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ DeepAI response:', data);

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

function createImagePrompt(formData) {
    // Create a specific prompt based on the product but keep it safe
    const productName = formData.productName || 'product';
    const businessType = formData.businessType || 'business';
    
    // Create product-specific but safe descriptions
    let productSpecific = '';
    if (productName.toLowerCase().includes('agarbatti') || productName.toLowerCase().includes('incense')) {
        productSpecific = 'traditional Indian incense sticks, aromatic, spiritual, temple style';
    } else if (productName.toLowerCase().includes('gel') && businessType === 'Healthcare') {
        productSpecific = 'cosmetic gel product, health and beauty, clean packaging';
    } else {
        productSpecific = `${productName} ${businessType} product, commercial quality`;
    }
    
    return `Professional advertisement image for ${productSpecific}, modern commercial design, clean background, product focused, high quality, marketing ready, ${formData.adFormat} format`;
}

function createImagePromptFromAdText(formData, adTextContent) {
    const productName = formData.productName || 'product';
    const businessType = formData.businessType || 'business';
    const adFormat = formData.adFormat || 'facebook-feed';
    
    // Extract key elements from the generated ad text
    const headline = adTextContent.headline || '';
    const adText = adTextContent.adText || '';
    
    // Create visual elements based on the ad content theme
    let visualTheme = '';
    let productVisuals = '';
    let moodKeywords = '';
    
    // Determine product visuals
    if (productName.toLowerCase().includes('agarbatti') || productName.toLowerCase().includes('incense')) {
        productVisuals = 'beautiful incense sticks, smoke wisps, traditional Indian setting, spiritual ambiance, temple elements';
    } else if (productName.toLowerCase().includes('gel') && businessType === 'Healthcare') {
        productVisuals = 'elegant cosmetic gel bottle, health and beauty product, clean modern packaging, spa-like setting';
    } else {
        productVisuals = `${productName} product, ${businessType} style, professional product photography`;
    }
    
    // Extract mood from ad text
    if (headline.toLowerCase().includes('peace') || adText.toLowerCase().includes('calm') || adText.toLowerCase().includes('tranquil')) {
        moodKeywords = 'peaceful, serene, calming colors, soft lighting, zen atmosphere';
    } else if (headline.toLowerCase().includes('love') || adText.toLowerCase().includes('heart') || adText.toLowerCase().includes('emotional')) {
        moodKeywords = 'warm, emotional, loving atmosphere, golden lighting, heartwarming';
    } else if (headline.toLowerCase().includes('divine') || adText.toLowerCase().includes('spiritual') || adText.toLowerCase().includes('blessing')) {
        moodKeywords = 'divine, spiritual, golden light, sacred, peaceful, traditional';
    } else if (headline.toLowerCase().includes('confidence') || adText.toLowerCase().includes('beauty') || adText.toLowerCase().includes('radiant')) {
        moodKeywords = 'confident, beautiful, glowing, radiant, elegant, sophisticated';
    } else {
        moodKeywords = 'positive, uplifting, professional, clean, modern';
    }
    
    // Combine elements for comprehensive prompt
    const comprehensivePrompt = `Professional ${adFormat} advertisement image: ${productVisuals}. Visual mood: ${moodKeywords}. Commercial photography style, high quality, marketing ready, clean composition, ${businessType} industry standard, suitable for ${formData.targetAudience} audience`;
    
    console.log('🎨 Created enhanced prompt from ad content:', comprehensivePrompt);
    return comprehensivePrompt;
}

function parseAdContent(content) {
    console.log('📝 Parsing content:', content);
    
    const lines = content.split('\n');
    let headline = '';
    let adText = '';
    let cta = '';

    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.includes('HEADLINE:')) {
            headline = trimmedLine.replace(/\*?\*?HEADLINE:\*?\*?/g, '').trim().replace(/^["']|["']$/g, '');
        } else if (trimmedLine.includes('AD_TEXT:')) {
            adText = trimmedLine.replace(/\*?\*?AD_TEXT:\*?\*?/g, '').trim().replace(/^["']|["']$/g, '');
        } else if (trimmedLine.includes('CTA:')) {
            cta = trimmedLine.replace(/\*?\*?CTA:\*?\*?/g, '').trim().replace(/^["']|["']$/g, '');
        }
    });

    // If parsing failed, try to extract from the content differently
    if (!headline || !adText || !cta) {
        console.log('⚠️ Standard parsing failed, trying alternative method');
        
        // Try to find content between ** markers
        const headlineMatch = content.match(/\*\*HEADLINE:\*\*\s*(.+?)(?=\*\*|$)/s);
        const adTextMatch = content.match(/\*\*AD_TEXT:\*\*\s*(.+?)(?=\*\*|$)/s);
        const ctaMatch = content.match(/\*\*CTA:\*\*\s*(.+?)(?=\*\*|$)/s);
        
        if (headlineMatch) headline = headlineMatch[1].trim().replace(/^["']|["']$/g, '');
        if (adTextMatch) adText = adTextMatch[1].trim().replace(/^["']|["']$/g, '');
        if (ctaMatch) cta = ctaMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    console.log('✅ Parsed result:', { headline, adText, cta });
    return { headline, adText, cta };
}

function setLoading(isLoading) {
    const btn = document.getElementById('generateBtn');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.loading-spinner');

    btn.disabled = isLoading;

    if (isLoading) {
        btnText.style.display = 'none';
        spinner.style.display = 'inline';
    } else {
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = 'background: #fee; color: #c33; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #fcc;';
    errorDiv.textContent = message;

    const form = document.getElementById('adForm');
    form.insertBefore(errorDiv, form.firstChild);

    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function displayResults(textContent, imageUrl) {
    currentAdData = textContent;
    currentImageUrl = imageUrl;

    const currentFormData = getFormData();

    updateAdPreview(textContent, imageUrl, currentFormData.adFormat);

    const performanceScore = calculatePerformanceScore(textContent, currentFormData);
    displayPerformanceScore(performanceScore);

    document.getElementById('resultSection').style.display = 'block';
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
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

async function downloadImage() {
    if (!currentImageUrl) {
        alert('No image to download');
        return;
    }

    try {
        const response = await fetch(currentImageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'facebook-ad-image.jpg';
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        console.log('✅ Image downloaded successfully');

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

function calculatePerformanceScore(textContent, formData) {
    let score = 70; // Base score

    if (textContent.headline) {
        const headlineWords = textContent.headline.split(' ').length;
        if (headlineWords >= 5 && headlineWords <= 10) score += 5;
    }

    if (textContent.adText && textContent.adText.length > 50) score += 5;
    if (textContent.cta && textContent.cta.length > 0) score += 10;
    if (formData.specialOffer) score += 10;

    return Math.min(score, 100);
}

function displayPerformanceScore(score) {
    const scoreColor = score >= 80 ? '#4CAF50' : score >= 60 ? '#FF9800' : '#F44336';
    const scoreEmoji = score >= 80 ? '🎯' : score >= 60 ? '👍' : '⚠️';

    const performanceHtml = `
        <div class="performance-score" style="background: linear-gradient(135deg, ${scoreColor}15, ${scoreColor}05); border-left: 4px solid ${scoreColor}; padding: 15px; margin: 15px 0; border-radius: 8px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <span style="font-size: 1.5rem;">${scoreEmoji}</span>
                <span style="font-weight: 600; color: ${scoreColor};">Performance Score: ${score}%</span>
            </div>
            <div style="font-size: 0.9rem; color: #666;">
                ${score >= 80 ? 'Excellent! This ad has high conversion potential.' : 
                  score >= 60 ? 'Good ad! Consider adding more emotional triggers.' : 
                  'Room for improvement. Try adding urgency or emotional appeal.'}
            </div>
        </div>
    `;

    document.querySelector('.ad-preview').insertAdjacentHTML('afterend', performanceHtml);
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