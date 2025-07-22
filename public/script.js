
// Configuration - API keys loaded from environment variables
let DEEPSEEK_API_KEY = '';
let DEEPAI_API_KEY = '';

// API endpoints
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPAI_API_URL = 'https://api.deepai.org/api/text2img';

// Global variables
let currentAdData = null;
let currentImageUrl = null;

// Event listeners
document.getElementById('adForm').addEventListener('submit', handleFormSubmit);

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = getFormData();
    if (!validateForm(formData)) return;
    
    console.log('🚀 Starting ad generation with form data:', formData);
    console.log('API Keys status - DeepSeek:', !!DEEPSEEK_API_KEY, 'DeepAI:', !!DEEPAI_API_KEY);
    
    setLoading(true);
    
    try {
        console.log('📝 Generating text content...');
        const textContent = await generateAdText(formData);
        console.log('✅ Text content generated:', textContent);
        
        console.log('🖼️ Generating image...');
        const imageUrl = await generateAdImage(formData.productDescription, formData.productName);
        console.log('✅ Image generated:', imageUrl);
        
        // Display results
        displayResults(textContent, imageUrl);
        
    } catch (error) {
        console.error('❌ Error generating ad:', error);
        console.error('Error details:', error.message, error.stack);
        alert(`Failed to generate ad: ${error.message}`);
    } finally {
        setLoading(false);
    }
}

function getFormData() {
    return {
        productName: document.getElementById('productName').value.trim(),
        productDescription: document.getElementById('productDescription').value.trim(),
        targetAudience: document.getElementById('targetAudience').value.trim(),
        businessType: document.getElementById('businessType').value,
        tone: document.getElementById('tone').value,
        adFormat: document.getElementById('adFormat').value,
        language: document.querySelector('input[name="language"]:checked').value
    };
}

function validateForm(data) {
    if (!data.productName || !data.productDescription || !data.targetAudience || !data.tone) {
        alert('Please fill in all required fields.');
        return false;
    }
    
    if (!DEEPSEEK_API_KEY || !DEEPAI_API_KEY) {
        alert('API keys are not loaded. Please refresh the page and try again.');
        return false;
    }
    
    return true;
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
        console.error('❌ DeepSeek API call failed:', error);
        throw new Error(`Text generation failed: ${error.message}`);
    }
}

function createTextPrompt(formData) {
    const { productName, productDescription, targetAudience, businessType, tone, language, adFormat } = formData;
    
    const businessContext = businessType ? ` Business type: ${businessType}.` : '';
    
    // Get format-specific instructions
    const formatInstructions = getFormatInstructions(adFormat);
    
    if (language === 'Hindi') {
        return `एक प्रभावशाली ${formatInstructions.name} विज्ञापन तैयार करो। प्रोडक्ट: ${productName}। विवरण: ${productDescription}। टारगेट ऑडियंस: ${targetAudience}।${businessContext} टोन: ${getToneInHindi(tone)}। 

${formatInstructions.hindiConstraints}

इस विज्ञापन में भारतीय संस्कृति और स्थानीय भावनाओं को ध्यान में रखें। कृपया निम्नलिखित format में जवाब दें:
HEADLINE: [आकर्षक हेडलाइन]
AD_TEXT: [मुख्य विज्ञापन टेक्स्ट]
CTA: [कॉल टू एक्शन]
HASHTAGS: [5 हैशटैग]`;
    } else {
        return `Write a high-converting ${formatInstructions.name} for ${productName}. Description: ${productDescription}. Target audience: ${targetAudience}.${businessContext} Tone: ${tone.toLowerCase()}.

${formatInstructions.constraints}

Create compelling copy that focuses on benefits, creates urgency, and includes social proof elements. Make it suitable for Indian market.

Please respond in this exact format:
HEADLINE: [Compelling headline]
AD_TEXT: [Main ad text]
CTA: [Call to action]
HASHTAGS: [5 hashtags]`;
    }
}

function getFormatInstructions(adFormat) {
    const formats = {
        'facebook-feed': {
            name: 'Facebook Feed Ad',
            constraints: 'Keep headline under 25 characters. Main text should be 90-125 characters for optimal engagement. Use engaging visuals and clear CTA.',
            hindiConstraints: 'हेडलाइन 25 अक्षरों के अंदर रखें। मुख्य टेक्स्ट 90-125 अक्षरों में हो।'
        },
        'instagram-story': {
            name: 'Instagram Story Ad',
            constraints: 'Very short and visual-focused. Headline max 15 words. Main text max 50 words. Must be mobile-optimized and eye-catching.',
            hindiConstraints: 'बहुत छोटा और विज़ुअल-फोकस्ड। हेडलाइन अधिकतम 15 शब्द।'
        },
        'google-search': {
            name: 'Google Search Ad',
            constraints: 'Headline 1: max 30 characters, Headline 2: max 30 characters. Description: max 90 characters. Focus on search intent and keywords.',
            hindiConstraints: 'हेडलाइन 1: अधिकतम 30 अक्षर, हेडलाइन 2: अधिकतम 30 अक्षर। विवरण: अधिकतम 90 अक्षर।'
        },
        'whatsapp-status': {
            name: 'WhatsApp Status Ad',
            constraints: 'Very casual and personal tone. Short, conversational text. Maximum 2-3 sentences. Include emojis for engagement.',
            hindiConstraints: 'बहुत आकस्मिक और व्यक्तिगत टोन। छोटा, बातचीत वाला टेक्स्ट।'
        }
    };
    
    return formats[adFormat] || formats['facebook-feed'];
}

function getToneInHindi(tone) {
    const toneMap = {
        'Energetic': 'जोशीला',
        'Funny': 'मजेदार',
        'Emotional': 'भावनात्मक',
        'Professional': 'व्यावसायिक'
    };
    return toneMap[tone] || tone;
}

function parseAdContent(content) {
    console.log('🔍 Parsing content:', content);
    
    const result = {
        headline: '',
        adText: '',
        cta: '',
        hashtags: ''
    };
    
    // Handle both plain and markdown formats - more flexible matching
    const headlineMatch = content.match(/(?:\*\*)?HEADLINE:?\*?\*?\s*(.*?)(?=\n\n|\*\*AD_TEXT|\*\*CTA|\*\*HASHTAGS|AD_TEXT|CTA|HASHTAGS|$)/s);
    
    const adTextMatch = content.match(/(?:\*\*)?AD_TEXT:?\*?\*?\s*(.*?)(?=\n\n|\*\*CTA|\*\*HASHTAGS|CTA|HASHTAGS|$)/s);
    
    const ctaMatch = content.match(/(?:\*\*)?CTA:?\*?\*?\s*(.*?)(?=\n\n|\*\*HASHTAGS|HASHTAGS|$)/s);
    
    const hashtagsMatch = content.match(/(?:\*\*)?HASHTAGS:?\*?\*?\s*(.*?)$/s);
    
    if (headlineMatch) {
        result.headline = headlineMatch[1].trim().replace(/\*\*/g, '').replace(/🚀|✨|📢/g, '').trim();
    }
    
    if (adTextMatch) {
        result.adText = adTextMatch[1].trim()
            .replace(/\*\*/g, '')
            .replace(/✅|✔|📩|🔥|💪/g, '')
            .replace(/\n\s*\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    if (ctaMatch) {
        result.cta = ctaMatch[1].trim().replace(/\*\*/g, '').replace(/📩|🔥|💪/g, '').trim();
    }
    
    if (hashtagsMatch) {
        result.hashtags = hashtagsMatch[1].trim().replace(/\*\*/g, '').trim();
    }
    
    console.log('📋 Parsed result:', result);
    return result;
}

async function generateAdImage(description, productName) {
    console.log('🔗 Making request to DeepAI API...');
    
    try {
        const formData = new FormData();
        formData.append('text', `Professional product advertisement for ${description}, high quality, commercial photography style, clean background, product showcase`);
        
        const response = await fetch(DEEPAI_API_URL, {
            method: 'POST',
            headers: {
                'api-key': DEEPAI_API_KEY
            },
            body: formData
        });
        
        console.log('📡 DeepAI API response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('DeepAI API error response:', errorText);
            throw new Error(`DeepAI API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('🖼️ DeepAI API response data:', data);
        
        if (!data.output_url) {
            throw new Error('No image URL returned from DeepAI API');
        }
        
        // Add product name overlay to the image
        const imageWithText = await addTextOverlay(data.output_url, productName);
        return imageWithText;
        
    } catch (error) {
        console.error('❌ DeepAI API call failed:', error);
        throw new Error(`Image generation failed: ${error.message}`);
    }
}

async function addTextOverlay(imageUrl, productName) {
    try {
        // Create a canvas to add text overlay
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Load the original image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        return new Promise((resolve, reject) => {
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw the original image
                ctx.drawImage(img, 0, 0);
                
                // Create professional overlay background
                const overlayHeight = img.height * 0.25;
                const gradient = ctx.createLinearGradient(0, img.height - overlayHeight, 0, img.height);
                gradient.addColorStop(0, 'rgba(0, 0, 0, 0.1)');
                gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.6)');
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(0, img.height - overlayHeight, img.width, overlayHeight);
                
                // Add stylish brand name
                const brandFontSize = Math.max(28, Math.min(img.width / 12, 56));
                ctx.font = `700 ${brandFontSize}px 'Arial Black', Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Add elegant text shadow with multiple layers
                ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;
                
                // Main brand text in white
                ctx.fillStyle = '#FFFFFF';
                const brandY = img.height - (overlayHeight * 0.4);
                ctx.fillText(productName.toUpperCase(), img.width / 2, brandY);
                
                // Add subtle tagline
                const taglineFontSize = Math.max(12, Math.min(img.width / 25, 24));
                ctx.font = `400 ${taglineFontSize}px Arial, sans-serif`;
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                
                const taglineY = brandY + brandFontSize * 0.8;
                ctx.fillText('✨ Premium Beauty Services ✨', img.width / 2, taglineY);
                
                // Add decorative elements
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                // Add corner accent
                const accentSize = Math.min(img.width, img.height) * 0.08;
                ctx.fillStyle = 'rgba(255, 215, 0, 0.8)'; // Gold accent
                ctx.fillRect(img.width - accentSize, img.height - accentSize, accentSize, accentSize);
                
                // Convert canvas to blob and create URL
                canvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    resolve(url);
                }, 'image/jpeg', 0.95);
            };
            
            img.onerror = () => {
                console.log('Failed to load image for text overlay, using original');
                resolve(imageUrl);
            };
            
            img.src = imageUrl;
        });
        
    } catch (error) {
        console.error('Failed to add text overlay:', error);
        return imageUrl; // Return original if overlay fails
    }
}

function displayResults(textContent, imageUrl) {
    currentAdData = textContent;
    currentImageUrl = imageUrl;
    
    const currentFormData = getFormData();
    
    // Update the preview based on selected format
    updateAdPreview(textContent, imageUrl, currentFormData.adFormat);
    
    // Calculate and display performance score
    const performanceScore = calculatePerformanceScore(textContent, currentFormData);
    displayPerformanceScore(performanceScore);
    
    // Show results section
    document.getElementById('resultSection').style.display = 'block';
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
}

function updateAdPreview(textContent, imageUrl, adFormat) {
    const adPreview = document.querySelector('.ad-preview');
    
    // Update heading based on format
    updatePreviewHeading(adFormat);
    
    // Update image
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
    
    // Update preview based on format
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
    document.getElementById('adHeadline').textContent = textContent.headline;
    document.getElementById('adText').textContent = textContent.adText;
    document.getElementById('adCTA').textContent = textContent.cta;
    document.getElementById('adHashtags').textContent = textContent.hashtags;
    
    // Reset any format-specific styling
    const adPreview = document.querySelector('.ad-preview');
    adPreview.className = 'ad-preview facebook-format';
}

function updateInstagramStoryPreview(textContent) {
    document.getElementById('adHeadline').textContent = textContent.headline;
    document.getElementById('adText').textContent = textContent.adText;
    document.getElementById('adCTA').textContent = textContent.cta;
    document.getElementById('adHashtags').textContent = textContent.hashtags;
    
    const adPreview = document.querySelector('.ad-preview');
    adPreview.className = 'ad-preview instagram-story-format';
}

function updateGoogleSearchPreview(textContent) {
    // Split headline for Google's 2-headline format
    const headlines = textContent.headline.split(' ');
    const headline1 = headlines.slice(0, Math.ceil(headlines.length/2)).join(' ');
    const headline2 = headlines.slice(Math.ceil(headlines.length/2)).join(' ');
    
    document.getElementById('adHeadline').innerHTML = `
        <div class="google-headline1">${headline1}</div>
        <div class="google-headline2">${headline2}</div>
    `;
    document.getElementById('adText').textContent = textContent.adText;
    document.getElementById('adCTA').textContent = textContent.cta;
    document.getElementById('adHashtags').style.display = 'none'; // Google ads don't show hashtags
    
    const adPreview = document.querySelector('.ad-preview');
    adPreview.className = 'ad-preview google-search-format';
}

function updateWhatsAppStatusPreview(textContent) {
    document.getElementById('adHeadline').textContent = textContent.headline;
    document.getElementById('adText').textContent = textContent.adText;
    document.getElementById('adCTA').textContent = textContent.cta;
    document.getElementById('adHashtags').textContent = textContent.hashtags;
    
    const adPreview = document.querySelector('.ad-preview');
    adPreview.className = 'ad-preview whatsapp-status-format';
}

function copyAdText() {
    if (!currentAdData) return;
    
    const textToCopy = `${currentAdData.headline}\n\n${currentAdData.adText}\n\n${currentAdData.cta}\n\n${currentAdData.hashtags}`;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        // Show feedback
        const btn = document.querySelector('.copy-btn');
        const originalText = btn.textContent;
        btn.textContent = '✅ Copied!';
        btn.style.background = '#28a745';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '#28a745';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy text. Please try again.');
    });
}

async function downloadImage() {
    if (!currentImageUrl) return;
    
    try {
        console.log('📥 Downloading image from:', currentImageUrl);
        
        // Fetch the image
        const response = await fetch(currentImageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
        }
        
        // Get the image blob
        const blob = await response.blob();
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'facebook-ad-image.jpg';
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
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

function generateVariations() {
    if (!currentAdData) {
        alert('Please generate an ad first!');
        return;
    }
    
    const formData = getFormData();
    if (!validateForm(formData)) return;
    
    console.log('🔄 Generating ad variations...');
    setLoading(true);
    
    // Generate 3 variations with different tones
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
    const container = document.getElementById('variationsContainer');
    if (!container) {
        // Create variations container if it doesn't exist
        const resultSection = document.querySelector('.result-section');
        const variationsDiv = document.createElement('div');
        variationsDiv.id = 'variationsContainer';
        variationsDiv.innerHTML = '<h3 style="margin: 20px 0 15px 0; color: #333;">Alternative Versions</h3>';
        resultSection.appendChild(variationsDiv);
        displayVariations(variations);
        return;
    }
    
    container.innerHTML = '<h3 style="margin: 20px 0 15px 0; color: #333;">Alternative Versions</h3>';
    
    variations.forEach(variation => {
        const variationCard = document.createElement('div');
        variationCard.className = 'variation-card';
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
    
    // Scroll to preview
    document.querySelector('.ad-preview').scrollIntoView({ behavior: 'smooth' });
}

function calculatePerformanceScore(textContent, formData) {
    let score = 70; // Base score
    
    // Check headline length (optimal: 5-10 words)
    const headlineWords = textContent.headline.split(' ').length;
    if (headlineWords >= 5 && headlineWords <= 10) score += 10;
    
    // Check for emotional words
    const emotionalWords = ['amazing', 'incredible', 'transform', 'unlock', 'master', 'boost', 'excel'];
    const hasEmotional = emotionalWords.some(word => 
        textContent.headline.toLowerCase().includes(word) || 
        textContent.adText.toLowerCase().includes(word)
    );
    if (hasEmotional) score += 10;
    
    // Check for urgency/scarcity
    const urgencyWords = ['limited', 'now', 'today', 'hurry', 'seats available'];
    const hasUrgency = urgencyWords.some(word => 
        textContent.adText.toLowerCase().includes(word) || 
        textContent.cta.toLowerCase().includes(word)
    );
    if (hasUrgency) score += 10;
    
    // Adjust for target audience specificity
    if (formData.targetAudience.split(' ').length >= 2) score += 5;
    
    return Math.min(score, 95); // Cap at 95%
}

function displayPerformanceScore(score) {
    const scoreColor = score >= 80 ? '#28a745' : score >= 60 ? '#ffc107' : '#dc3545';
    const scoreEmoji = score >= 80 ? '🚀' : score >= 60 ? '⚡' : '💡';
    
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

// Load configuration when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Load config from the config endpoint
    const script = document.createElement('script');
    script.src = window.location.origin + '/config.js?t=' + Date.now();
    
    script.onload = function() {
        if (window.CONFIG) {
            DEEPSEEK_API_KEY = window.CONFIG.DEEPSEEK_API_KEY;
            DEEPAI_API_KEY = window.CONFIG.DEEPAI_API_KEY;
            
            console.log('✅ API keys loaded successfully');
            console.log('DEEPSEEK_API_KEY loaded:', !!DEEPSEEK_API_KEY);
            console.log('DEEPAI_API_KEY loaded:', !!DEEPAI_API_KEY);
        } else {
            console.error('CONFIG object not found');
        }
    };
    
    script.onerror = function() {
        console.error('Failed to load config.js');
    };
    
    document.head.appendChild(script);
    // Add placeholder text based on selected language
    const languageInputs = document.querySelectorAll('input[name="language"]');
    
    languageInputs.forEach(input => {
        input.addEventListener('change', function() {
            updatePlaceholders(this.value);
        });
    });
    
    function updatePlaceholders(language) {
        const productName = document.getElementById('productName');
        const productDescription = document.getElementById('productDescription');
        const targetAudience = document.getElementById('targetAudience');
        
        if (language === 'Hindi') {
            productName.placeholder = 'उदा., एरोमैजिक कॉफी बीन्स';
            productDescription.placeholder = 'अपने उत्पाद का विस्तृत विवरण दें...';
            targetAudience.placeholder = 'उदा., युवा प्रोफेशनल्स, कॉफी प्रेमी';
        } else {
            productName.placeholder = 'e.g., Aromagic Coffee Beans';
            productDescription.placeholder = 'Describe your product in detail...';
            targetAudience.placeholder = 'e.g., Young professionals, Coffee lovers';
        }
    }
});
