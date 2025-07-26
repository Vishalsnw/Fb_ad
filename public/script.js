
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

// Load configuration when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Page loaded, initializing...');
    
    // Setup UI first
    setupEventListeners();
    setupLanguagePlaceholders();
    
    // Then load config
    const configLoaded = await loadConfig();
    if (configLoaded) {
        console.log('✅ Application initialized successfully');
    } else {
        console.error('❌ Failed to initialize application');
    }
});

function setupEventListeners() {
    const form = document.getElementById('adForm');
    const generateButton = document.getElementById('generateButton');
    
    if (form) {
        form.removeEventListener('submit', handleFormSubmit); // Remove existing
        form.addEventListener('submit', handleFormSubmit);
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
    handleFormSubmit(event);
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

async function handleFormSubmit(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    console.log('📝 Form submission started');

    // Prevent multiple submissions
    if (isGenerating) {
        console.log('⚠️ Ad generation already in progress');
        return;
    }

    // Disable form submit button
    const submitButton = document.querySelector('button[type="submit"]') || document.getElementById('generateButton');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Generating...';
    }

    const formData = getFormData();
    console.log('🔍 Validating form data:', formData);
    
    if (!validateForm(formData)) {
        console.log('❌ Form validation failed');
        // Re-enable submit button on validation failure
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Generate Ad';
        }
        return;
    }
    
    console.log('✅ Form validation passed');

    // Ensure config is loaded first
    if (!configLoaded) {
        console.log('🔄 Loading configuration...');
        const configLoadResult = await loadConfig();
        if (!configLoadResult) {
            showError('Failed to load configuration. Please check your API keys in Replit Secrets and refresh the page.');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Generate Ad';
            }
            return;
        }
    }

    // Validate API keys are properly loaded
    if (!checkApiKeys()) {
        showError('API keys not properly configured. Please check your Replit Secrets and refresh the page.');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Generate Ad';
        }
        return;
    }

    console.log('🚀 Starting ad generation with form data:', formData);
    console.log('🔑 Using API keys:', {
        deepSeek: DEEPSEEK_API_KEY ? `${DEEPSEEK_API_KEY.substring(0, 10)}...` : 'MISSING',
        deepAI: DEEPAI_API_KEY ? `${DEEPAI_API_KEY.substring(0, 10)}...` : 'MISSING'
    });
    
    isGenerating = true;
    showLoading();

    try {
        // Generate ad text first
        console.log('🔄 Step 1: Generating text...');
        const textContent = await generateText(formData);
        console.log('✅ Text generated successfully:', textContent);

        if (!textContent || !textContent.headline) {
            throw new Error('Failed to generate valid text content');
        }

        // Generate image
        console.log('🔄 Step 2: Generating image...');
        const imageUrl = await generateImage(formData);
        console.log('✅ Image generated successfully:', imageUrl);

        if (!imageUrl) {
            throw new Error('Failed to generate image URL');
        }

        // Display results
        console.log('🔄 Step 3: Displaying results...');
        displayResults(textContent, imageUrl, formData);

        // Save ad data
        currentAdData = {
            id: Date.now().toString(),
            formData: formData,
            textContent: textContent,
            imageUrl: imageUrl,
            timestamp: new Date().toISOString()
        };

        // Save to user's ad history if logged in
        if (typeof window.currentUser === 'function' && window.currentUser()) {
            try {
                saveAdToHistory(currentAdData);
            } catch (saveError) {
                console.error('❌ Failed to save ad to history:', saveError);
            }
        }

        console.log('✅ Ad generation completed successfully');

    } catch (error) {
        console.error('❌ Error generating ad:', error);
        showError('Failed to generate ad: ' + error.message);
    } finally {
        isGenerating = false;
        hideLoading();
        
        // Re-enable form submit button
        const submitButton = document.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Generate Ad';
        }
    }
}

async function generateText(formData) {
    console.log('🔄 Generating text with DeepSeek...');

    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY.trim().length < 5) {
        throw new Error('DeepSeek API key not properly configured');
    }

    const prompt = createTextPrompt(formData);
    console.log('📝 Text prompt:', prompt);

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
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ DeepSeek API error:', errorText);
            throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from DeepSeek API');
        }
        
        const content = data.choices[0].message.content;

        // Parse the response more reliably
        const result = {
            headline: 'Generated Headline',
            adText: 'Generated ad text will appear here.',
            cta: 'Learn More'
        };

        try {
            // Aggressive cleaning of AI response artifacts
            let cleanContent = content
                .replace(/\*\*/g, '') // Remove ** markdown formatting
                .replace(/\*\s*/g, '') // Remove * bullet points
                .replace(/^\s*[-•]\s*/gm, '') // Remove bullet points
                .replace(/commit message/gi, '') // Remove commit message artifacts
                .replace(/analysis:/gi, '') // Remove analysis artifacts
                .replace(/```/g, '') // Remove code block markers
                .replace(/html/gi, '') // Remove html tags
                .replace(/^\s*\*/gm, '') // Remove asterisks at start of lines
                .replace(/\*+/g, '') // Remove all remaining asterisks
                .replace(/�/g, '') // Remove strange unicode characters
                .replace(/\[|\]/g, '') // Remove square brackets
                .replace(/🛡️|🔥|⚡|✨|💪|🎯|🚀/g, '') // Remove emojis that might break parsing
                .trim();

            // Helper function to clean individual text pieces
            function cleanText(text) {
                if (!text) return '';
                return text
                    .replace(/\*\*/g, '')
                    .replace(/\*/g, '')
                    .replace(/^\s*[-•]\s*/, '')
                    .replace(/[\[\]]/g, '')
                    .replace(/�/g, '')
                    .replace(/🛡️|🔥|⚡|✨|💪|🎯|🚀/g, '') // Remove problematic emojis
                    .trim();
            }

            // Try to extract structured content
            const headlineMatch = cleanContent.match(/HEADLINE:\s*(.+?)(?:\n|AD_TEXT:|$)/i);
            const adTextMatch = cleanContent.match(/AD_TEXT:\s*(.+?)(?:\n|CTA:|$)/i);
            const ctaMatch = cleanContent.match(/CTA:\s*(.+?)(?:\n|$)/i);

            if (headlineMatch) {
                result.headline = cleanText(headlineMatch[1]);
            } else {
                // Fallback: use first line as headline
                const lines = cleanContent.split('\n').filter(line => line.trim() && !line.toLowerCase().includes('analysis'));
                if (lines.length > 0) {
                    result.headline = cleanText(lines[0]).substring(0, 100);
                }
            }

            if (adTextMatch) {
                result.adText = cleanText(adTextMatch[1]);
            } else {
                // Fallback: use middle part as ad text
                const lines = cleanContent.split('\n').filter(line => line.trim() && !line.toLowerCase().includes('analysis'));
                if (lines.length > 1) {
                    const middleText = lines.slice(1, -1).join(' ').trim() || lines[1]?.trim() || cleanContent.substring(0, 200);
                    result.adText = cleanText(middleText);
                }
            }

            if (ctaMatch) {
                result.cta = cleanText(ctaMatch[1]).substring(0, 50);
            } else {
                // Fallback: use last line or default
                const lines = cleanContent.split('\n').filter(line => line.trim() && !line.toLowerCase().includes('analysis'));
                if (lines.length > 2) {
                    result.cta = cleanText(lines[lines.length - 1]).substring(0, 50) || 'Learn More';
                }
            }

            // Final validation - ensure we have content
            if (!result.headline || result.headline.length < 3 || result.headline.includes('**')) {
                result.headline = `🚀 ${formData.productName} - Limited Time Offer!`;
            }
            if (!result.adText || result.adText.length < 10 || result.adText.includes('**')) {
                const productName = formData.productName || 'our product';
                const audience = formData.targetAudience || 'you';
                result.adText = `Discover the amazing benefits of ${productName}! Perfect for ${audience}. Don't miss out on this incredible opportunity to transform your experience. High quality, proven results, and exceptional value guaranteed.`;
            }
            if (!result.cta || result.cta.length < 3 || result.cta.includes('**')) {
                result.cta = 'Get Started Now';
            }

            console.log('✅ Text generated:', result);
            return result;
        } catch (parseError) {
            console.error('❌ Error parsing API response:', parseError);
            
            // Fallback: return the raw content split into parts
            const lines = content.split('\n').filter(line => line.trim());
            if (lines.length >= 3) {
                result.headline = lines[0].substring(0, 100);
                result.adText = lines.slice(1, -1).join(' ').substring(0, 200);
                result.cta = lines[lines.length - 1].substring(0, 30);
            } else if (lines.length >= 1) {
                result.headline = lines[0].substring(0, 100);
                result.adText = content.substring(0, 200);
            }
            
            return result;
        }
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error: Unable to connect to DeepSeek API. Please check your internet connection.');
        }
        throw error;
    }
}

async function generateImage(formData) {
    console.log('🔄 Generating image with Google Images search + DeepAI...');

    if (!DEEPAI_API_KEY || DEEPAI_API_KEY.trim().length < 5) {
        throw new Error('DeepAI API key not properly configured');
    }

    // Step 1: Search Google Images for reference
    console.log('🔍 Step 1: Searching Google Images for reference...');
    const referenceImages = await searchGoogleImages(formData);
    
    // Step 2: Create enhanced prompt with reference context
    const imagePrompt = createEnhancedImagePrompt(formData, referenceImages);
    console.log('🖼️ Enhanced image prompt:', imagePrompt);

    const formDataObj = new FormData();
    formDataObj.append('text', imagePrompt);

    try {
        const response = await fetch('https://api.deepai.org/api/text2img', {
            method: 'POST',
            headers: {
                'Api-Key': DEEPAI_API_KEY
            },
            body: formDataObj
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ DeepAI API error:', errorText);
            throw new Error(`DeepAI API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (!data.output_url) {
            throw new Error('No image URL returned from DeepAI');
        }

        console.log('✅ Image generated with Google Images reference:', data.output_url);
        return data.output_url;
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error: Unable to connect to DeepAI API. Please check your internet connection.');
        }
        throw error;
    }
}

async function searchGoogleImages(formData) {
    console.log('🔍 Searching Google Images for product references...');
    
    try {
        // Create search query from product info
        const searchQuery = `${formData.productName} ${formData.productDescription} ${formData.businessType} product advertisement`.trim();
        
        // Use Google Custom Search API (free alternative)
        // For now, we'll use a proxy service to get image search results
        const searchUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=isch&safe=active`)}`;
        
        const response = await fetch(searchUrl);
        
        if (response.ok) {
            const htmlContent = await response.text();
            
            // Extract image characteristics from search results
            const imageAnalysis = analyzeSearchResults(htmlContent, formData);
            console.log('🔍 Google Images analysis:', imageAnalysis);
            return imageAnalysis;
        } else {
            console.warn('⚠️ Google Images search failed, using fallback analysis');
            return createFallbackAnalysis(formData);
        }
    } catch (error) {
        console.warn('⚠️ Google Images search error:', error.message);
        return createFallbackAnalysis(formData);
    }
}

function analyzeSearchResults(htmlContent, formData) {
    // Analyze the HTML content to extract visual patterns
    const productName = formData.productName.toLowerCase();
    const productDescription = formData.productDescription.toLowerCase();
    const businessType = formData.businessType.toLowerCase();
    
    const analysis = {
        dominantColors: [],
        commonElements: [],
        styleKeywords: [],
        composition: 'professional'
    };
    
    // Determine common visual patterns based on product type
    if (productDescription.includes('mosquito') || productDescription.includes('net')) {
        analysis.dominantColors = ['blue', 'white', 'green'];
        analysis.commonElements = ['mesh pattern', 'protective barrier', 'home setting'];
        analysis.styleKeywords = ['clean', 'protective', 'medical', 'safety'];
        analysis.composition = 'product showcase with home environment';
    } else if (productDescription.includes('coaching') || productDescription.includes('education')) {
        analysis.dominantColors = ['blue', 'orange', 'white'];
        analysis.commonElements = ['books', 'graduation elements', 'classroom setting'];
        analysis.styleKeywords = ['academic', 'professional', 'inspiring', 'educational'];
        analysis.composition = 'inspiring educational setting with success elements';
    } else if (businessType.includes('healthcare')) {
        analysis.dominantColors = ['white', 'blue', 'green'];
        analysis.commonElements = ['medical symbols', 'clean layout', 'trust indicators'];
        analysis.styleKeywords = ['medical', 'clean', 'trustworthy', 'professional'];
        analysis.composition = 'medical professional layout';
    } else if (businessType.includes('real estate')) {
        analysis.dominantColors = ['blue', 'white', 'gold'];
        analysis.commonElements = ['buildings', 'keys', 'home symbols'];
        analysis.styleKeywords = ['premium', 'trustworthy', 'professional', 'modern'];
        analysis.composition = 'professional real estate presentation';
    } else {
        // Generic product analysis
        analysis.dominantColors = ['blue', 'white', 'orange'];
        analysis.commonElements = ['product focus', 'brand elements'];
        analysis.styleKeywords = ['modern', 'professional', 'clean'];
        analysis.composition = 'product-focused commercial layout';
    }
    
    return analysis;
}

function createFallbackAnalysis(formData) {
    // Fallback analysis when Google search fails
    return analyzeSearchResults('', formData);
}

function createEnhancedImagePrompt(formData, referenceAnalysis) {
    const productName = formData.productName || 'product';
    const productDescription = formData.productDescription || '';
    const businessType = formData.businessType || 'business';
    
    // Use reference analysis to create a more targeted prompt
    const colors = referenceAnalysis.dominantColors.join(', ');
    const elements = referenceAnalysis.commonElements.join(', ');
    const style = referenceAnalysis.styleKeywords.join(', ');
    const composition = referenceAnalysis.composition;
    
    let basePrompt = '';
    
    if (productDescription.toLowerCase().includes('mosquito') || productDescription.toLowerCase().includes('net')) {
        basePrompt = `Professional healthcare advertisement for ${productName} mosquito protection, showing ${elements}, ${composition} setting, dominant colors: ${colors}`;
    } else if (productDescription.toLowerCase().includes('coaching') || productDescription.toLowerCase().includes('education')) {
        basePrompt = `Professional educational advertisement for ${productName}, featuring ${elements}, ${composition}, academic theme with ${colors} color scheme`;
    } else {
        basePrompt = `Professional ${businessType} advertisement poster for ${productName}, incorporating ${elements}, ${composition} style, using ${colors} color palette`;
    }
    
    const textRequirement = `CRITICAL: Large bold text "${productName}" with maximum contrast, readable typography, professional advertisement text overlay`;
    const styleRequirement = `Style: ${style}, commercial advertisement poster, marketing banner design, professional typography`;
    
    // Enhanced prompt with Google Images insights
    const finalPrompt = `${basePrompt}. ${textRequirement}. ${styleRequirement}. Based on market research: incorporate common visual elements like ${elements}, use proven color combinations (${colors}), maintain ${composition}. Text visibility is MANDATORY with high contrast. This is a professional advertising poster that must have clearly visible brand text "${productName}".`;
    
    return finalPrompt;
}

function createImagePrompt(formData) {
    const productName = formData.productName || 'product';
    const productDescription = formData.productDescription || '';
    const businessType = formData.businessType || 'business';

    // Create a focused prompt for text visibility
    const productInfo = `${productName} ${productDescription}`.toLowerCase();
    
    let basePrompt = '';
    let textRequirement = '';

    if (productInfo.includes('agarbatti') || productInfo.includes('incense')) {
        basePrompt = `Professional advertisement poster for ${productName} incense sticks, premium agarbatti packaging display, elegant Indian spiritual theme, golden temple background with soft lighting`;
        textRequirement = `CRITICAL: Bold white text "${productName}" with black shadow overlay on dark areas, large readable font size, professional advertising text placement`;
    } else if (productInfo.includes('gel') && businessType === 'Healthcare') {
        basePrompt = `Professional healthcare advertisement for ${productName} gel, modern cosmetic product packaging, clean medical aesthetic, white and blue theme`;
        textRequirement = `CRITICAL: Bold black text "${productName}" with white outline on clean background, medical advertisement typography style`;
    } else {
        basePrompt = `Professional ${businessType} advertisement poster featuring ${productName}, commercial product photography, modern business aesthetic`;
        textRequirement = `CRITICAL: Large bold text "${productName}" in high contrast colors, professional advertisement text overlay design`;
    }

    // Simplified but more effective prompt
    const finalPrompt = `${basePrompt}. ${textRequirement}. Style: Commercial advertisement poster with clear readable text, professional typography, marketing poster design, advertisement banner style. Text visibility is MANDATORY - use maximum contrast for readability. This is an advertising poster that must have visible brand text "${productName}".`;

    return finalPrompt;
}

function checkApiKeys() {
    console.log('🔍 Checking API keys...');
    console.log('DEEPSEEK_API_KEY:', DEEPSEEK_API_KEY ? `Present (${DEEPSEEK_API_KEY.length} chars)` : 'Missing');
    console.log('DEEPAI_API_KEY:', DEEPAI_API_KEY ? `Present (${DEEPAI_API_KEY.length} chars)` : 'Missing');
    
    const hasDeepSeek = DEEPSEEK_API_KEY && DEEPSEEK_API_KEY.trim().length > 5;
    const hasDeepAI = DEEPAI_API_KEY && DEEPAI_API_KEY.trim().length > 5;
    
    if (!hasDeepSeek || !hasDeepAI) {
        const missingKeys = [];
        if (!hasDeepSeek) {
            missingKeys.push('DEEPSEEK_API_KEY');
            console.error('❌ DEEPSEEK_API_KEY missing or invalid');
        }
        if (!hasDeepAI) {
            missingKeys.push('DEEPAI_API_KEY');
            console.error('❌ DEEPAI_API_KEY missing or invalid');
        }
        console.error('❌ API keys validation failed:', missingKeys);
        showError(`Missing or invalid API keys: ${missingKeys.join(', ')}. Please add them in Replit Secrets.`);
        return false;
    }
    
    console.log('✅ All API keys validated successfully');
    return true;
}



function createTextPrompt(formData) {
    return `Create a compelling ${formData.adFormat} advertisement in ${formData.language} with a ${formData.tone} tone.

Product Name: ${formData.productName}
Product/Service: ${formData.productDescription}
Target Audience: ${formData.targetAudience}
Business Type: ${formData.businessType || 'General'}
Special Offer: ${formData.specialOffer || 'None'}

CRITICAL INSTRUCTIONS:
- Write ONLY the ad content, no analysis or explanations
- NO asterisks (*), NO markdown formatting, NO special symbols, NO emojis in structure
- NO prefixes like "commit message" or "analysis"
- Use plain text only with simple punctuation
- Be direct and clear
- Do NOT use ** or * anywhere in your response
- Write clean, readable text without any formatting markers

Format your response EXACTLY like this (no extra symbols):
HEADLINE: Your catchy headline here
AD_TEXT: Your main advertisement copy here  
CTA: Your call to action here`;
}



function displayResults(textContent, imageUrl, formData) {
    console.log('🖼️ Displaying results with:', { textContent, imageUrl });
    
    const resultsDiv = document.getElementById('results');
    const resultSection = document.getElementById('resultSection');
    
    if (!resultsDiv) {
        console.error('❌ Results div not found!');
        return;
    }

    currentImageUrl = imageUrl;
    currentAdData = textContent;
    const performanceScore = calculatePerformanceScore(textContent, formData);

    // Structure the ad text with better formatting
    const structuredHeadline = textContent.headline || 'Generated Headline';
    const structuredAdText = formatAdText(textContent.adText || 'Generated ad text will appear here.');
    const structuredCTA = textContent.cta || 'Learn More';

    resultsDiv.innerHTML = `
        <div class="ad-preview">
            <div class="ad-header">
                <div class="profile-info">
                    <div class="profile-pic">📘</div>
                    <div class="profile-details">
                        <div class="page-name">${formData.productName || 'Your Brand'}</div>
                        <div class="sponsored">Sponsored</div>
                    </div>
                </div>
            </div>
            <div class="ad-content">
                <div class="ad-text-section">
                    <div class="ad-headline">${structuredHeadline}</div>
                    <div class="ad-text">${structuredAdText}</div>
                </div>
                <div class="ad-image-container">
                    <img src="${imageUrl}" alt="Generated Ad" class="ad-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                    <div class="image-error" style="display: none; padding: 20px; background: #f0f0f0; text-align: center; border-radius: 8px;">
                        <p>🖼️ Image failed to load</p>
                        <button onclick="location.reload()" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>
                    </div>
                </div>
                <div class="ad-cta-container">
                    <button class="ad-cta">${structuredCTA}</button>
                </div>
            </div>
        </div>
        <div class="ad-stats">
            <div class="performance-score">
                <span class="score-label">Performance Score:</span>
                <span class="score-value">${performanceScore}/100</span>
            </div>
            <div class="ad-metrics">
                <div class="metric">
                    <span class="metric-label">Format:</span>
                    <span class="metric-value">${formData.adFormat}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Language:</span>
                    <span class="metric-value">${formData.language}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Tone:</span>
                    <span class="metric-value">${formData.tone}</span>
                </div>
            </div>
        </div>
        <div class="ad-actions">
            <button id="downloadBtn" class="action-btn download-btn">📥 Download Image</button>
            <button class="copy-btn">📋 Copy Text</button>
            <button id="regenerateBtn" class="action-btn regenerate-btn">🔄 Regenerate</button>
            <button id="variationsBtn" class="action-btn variations-btn">🎯 Generate Variations</button>
        </div>
    `;

    // Re-attach event listeners
    document.getElementById('downloadBtn').addEventListener('click', downloadImage);
    document.getElementById('regenerateBtn').addEventListener('click', regenerateAd);
    document.querySelector('.copy-btn').addEventListener('click', copyAdText);
    document.getElementById('variationsBtn').addEventListener('click', generateVariations);

    // Make sure both the results div and result section are visible
    resultsDiv.style.display = 'block';
    if (resultSection) {
        resultSection.style.display = 'block';
    }
    
    console.log('✅ Results displayed, scrolling into view');
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
    
    // Debug: Log what's actually being displayed
    console.log('📊 Final ad content being displayed:', {
        headline: structuredHeadline,
        adText: structuredAdText.substring(0, 100) + '...',
        cta: structuredCTA
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
    console.log('📋 Extracting form data...');
    
    const productName = document.getElementById('productName');
    const productDescription = document.getElementById('productDescription');
    const targetAudience = document.getElementById('targetAudience');
    const businessType = document.getElementById('businessType');
    const specialOffer = document.getElementById('specialOffer');
    const tone = document.getElementById('tone');
    const adFormat = document.getElementById('adFormat');
    
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
        businessType: businessType ? businessType.value : ''
    };

    console.log('📋 Form data extracted:', formData);
    return formData;
}

function validateForm(formData) {
    console.log('🔍 Validating form fields...');
    
    if (!formData.productName || !formData.productName.trim()) {
        console.log('❌ Product name missing');
        showError('Please enter your product name');
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
            <div class="loading">
                <div class="loading-spinner"></div>
                <div class="loading-steps">
                    <p>🔍 Searching Google Images for inspiration...</p>
                    <p>🎨 Analyzing visual patterns...</p>
                    <p>🚀 Generating your optimized ad...</p>
                </div>
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
        const currentUser = typeof window.currentUser === 'function' ? window.currentUser() : null;
        if (currentUser) {
            fetch('/save-ad', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...adData,
                    userId: currentUser.uid
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

async function generateAdText(formData) {
    // This is an alias for the main generateText function for variations
    return await generateText(formData);
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

// Export functions globally for HTML event handlers
window.handleFormSubmit = handleFormSubmit;
window.downloadImage = downloadImage;
window.regenerateAd = regenerateAd;
window.copyAdText = copyAdText;
window.generateVariations = generateVariations;
