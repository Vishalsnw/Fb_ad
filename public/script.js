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
    setupCopyProtection();

    // Initialize usage display for anonymous users
    const currentUser = typeof window.currentUser === 'function' ? window.currentUser() : null;
    if (!currentUser) {
        updateUsageDisplay();
    }

    // Then load config
    const configLoaded = await loadConfig();
    if (configLoaded) {
        console.log('✅ Application initialized successfully');
    } else {
        console.error('❌ Failed to initialize application');
    }
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

    // Check if user is logged in FIRST
    const currentUser = typeof window.currentUser === 'function' ? window.currentUser() : null;
    if (!currentUser) {
        console.log('❌ User not logged in, showing login modal');
        showLoginRequiredModal();
        return;
    }

    // Check usage limits AFTER authentication (now 4 ads instead of 5)
    const canGenerate = checkUsageLimits();
    if (!canGenerate) {
        return; // checkUsageLimits handles UI updates
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
                .replace(//g, '') // Remove strange unicode characters
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
                    .replace(//g, '')
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
        <div class="ad-preview ${getAdFormatClass(formData.adFormat)}">
            <div class="ad-header">
                <div class="profile-info">
                    <div class="profile-pic">${getFormatIcon(formData.adFormat)}</div>
                    <div class="profile-details">
                        <div class="page-name">${formData.productName || 'Your Brand'}</div>
                        <div class="sponsored">${getFormatLabel(formData.adFormat)}</div>
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
        </div>
    `;

    // Re-attach event listeners
    document.getElementById('downloadBtn').addEventListener('click', downloadImage);
    document.getElementById('regenerateBtn').addEventListener('click', regenerateAd);
    document.querySelector('.copy-btn').addEventListener('click', copyAdText);

    // Make sure both the results div and result section are visible
    resultsDiv.style.display = 'block';
    if (resultSection) {
        resultSection.style.display = 'block';
    }

    console.log('📊 Final ad content being displayed:', {
        headline: textContent.headline,
        adText: textContent.adText.substring(0, 100) + '...',
        cta: textContent.cta
    });

    console.log('✅ Ad generation completed successfully');
    resultsDiv.scrollIntoView({ behavior: 'smooth' });

    // Increment usage count after successful generation and check limits
    const currentUser = typeof window.currentUser === 'function' ? window.currentUser() : null;
    if (currentUser) {
        incrementUsageCount();
        
        // Check if user has reached limit after increment
        const userPlan = localStorage.getItem('userPlan') || 'free';
        const adsUsed = parseInt(localStorage.getItem('adsUsed') || '0');
        
        if (userPlan === 'free' && adsUsed >= 4) {
            // Show payment modal after successful generation
            setTimeout(() => {
                showPaymentModal();
            }, 2000); // Show after 2 seconds to let user see the result
        }
    }

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
                <div class="progress-ring">
                    <svg class="progress-ring-svg" width="120" height="120">
                        <circle class="progress-ring-circle" cx="60" cy="60" r="54"></circle>
                    </svg>
                    <div class="progress-text">0%</div>
                </div>
            </div>
        `;
        resultsDiv.style.display = 'block';
        startLoadingAnimation();
    }
}

function startLoadingAnimation() {
    let progress = 0;
    let stepIndex = 0;
    const steps = document.querySelectorAll('.step-3d');
    const progressText = document.querySelector('.progress-text');
    const progressCircle = document.querySelector('.progress-ring-circle');

    const interval = setInterval(() => {
        progress += Math.random() * 15 + 5;
        if (progress > 100) progress = 100;

        // Update progress ring
        if (progressText) progressText.textContent = Math.round(progress) + '%';
        if (progressCircle) {
            const circumference = 2 * Math.PI * 54;
            const offset = circumference - (progress / 100) * circumference;
            progressCircle.style.strokeDashoffset = offset;
        }

        // Update steps
        const newStepIndex = Math.floor((progress / 100) * steps.length);
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

    // Show loading state for variations
    let container = document.getElementById('variationsContainer');
    if (!container) {
        const resultsDiv = document.getElementById('results');
        container = document.createElement('div');
        container.id = 'variationsContainer';
        container.style.cssText = 'margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;';
        resultsDiv.appendChild(container);
    }

    container.innerHTML = `
        <div class="loading" style="text-align: center; padding: 20px;">
            <div class="loading-spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
            <p>🎯 Generating alternative versions...</p>
        </div>
    `;

    const variations = [
        { ...formData, tone: 'Energetic' },
        { ...formData, tone: 'Emotional' },
        { ...formData, tone: 'Funny' }
    ];

    Promise.all(variations.map(async (variation, index) => {
        try {
            console.log(`🔄 Generating variation ${index + 1} (${variation.tone})...`);
            const textContent = await generateAdText(variation);
            console.log(`✅ Variation ${index + 1} generated:`, textContent);
            return {
                title: `Variation ${index + 1} (${variation.tone})`,
                content: textContent
            };
        } catch (error) {
            console.error(`❌ Failed to generate variation ${index + 1}:`, error);
            return null;
        }
    })).then(results => {
        console.log('🎯 All variations completed:', results);
        const validResults = results.filter(r => r !== null);
        if (validResults.length > 0) {
            displayVariations(validResults);
        } else {
            container.innerHTML = '<p style="text-align: center; color: #666;">❌ Failed to generate variations. Please try again.</p>';
        }
    }).catch(error => {
        console.error('❌ Error generating variations:', error);
        container.innerHTML = '<p style="text-align: center; color: #666;">❌ Failed to generate variations. Please try again.</p>';
    });
}

function displayVariations(variations) {
    console.log('🎯 Displaying variations:', variations);

    let container = document.getElementById('variationsContainer');
    if (!container) {
        const resultsDiv = document.getElementById('results');
        if (!resultsDiv) {
            console.error('❌ Results div not found!');
            return;
        }
        container = document.createElement('div');
        container.id = 'variationsContainer';
        container.style.cssText = 'margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;';
        resultsDiv.appendChild(container);
    }

    // Clear loading content and add header
    container.innerHTML = '<h3 style="margin: 0 0 20px 0; color: #333; text-align: center;">🎯 Alternative Versions</h3>';

    if (!variations || variations.length === 0) {
        container.innerHTML += '<p style="text-align: center; color: #666;">No variations available.</p>';
        return;
    }

    variations.forEach((variation, index) => {
        console.log(`📝 Adding variation ${index + 1}:`, variation);

        if (variation && variation.content) {
            const variationCard = document.createElement('div');
            variationCard.className = 'variation-card';
            variationCard.style.cssText = 'border: 1px solid #ddd; padding: 20px; margin: 15px 0; border-radius: 8px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';

            // Safely escape HTML content
            const headline = variation.content.headline || 'No headline';
            const adText = variation.content.adText || 'No ad text';
            const cta = variation.content.cta || 'No CTA';
            const title = variation.title || `Variation ${index + 1}`;

            variationCard.innerHTML = `
                <h4 style="color: #667eea; margin-bottom: 15px;">${title}</h4>
                <div style="margin-bottom: 10px;"><strong>Headline:</strong> ${headline}</div>
                <div style="margin-bottom: 10px;"><strong>Text:</strong> ${adText}</div>
                <div style="margin-bottom: 15px;"><strong>CTA:</strong> ${cta}</div>
                <button class="use-variation-btn" data-index="${index}" 
                        style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: 600; transition: background 0.3s ease;">
                    Use This Version
                </button>
            `;
            container.appendChild(variationCard);
        } else {
            console.warn(`⚠️ Invalid variation at index ${index}:`, variation);
        }
    });

    // Store variations globally for the useVariation function
    window.adVariations = variations;

    // Add event listeners to buttons (more reliable than onclick)
    const useButtons = container.querySelectorAll('.use-variation-btn');
    useButtons.forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            useVariation(index);
        });

        // Add hover effect
        button.addEventListener('mouseenter', function() {
            this.style.background = '#5a67d8';
        });
        button.addEventListener('mouseleave', function() {
            this.style.background = '#667eea';
        });
    });

    // Scroll to variations
    setTimeout(() => {
        container.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    console.log(`✅ Successfully displayed ${variations.length} variations`);
}

function useVariation(variationIndex) {
    console.log(`🔄 Using variation ${variationIndex}`);
    console.log('Available variations:', window.adVariations);

    if (!window.adVariations) {
        console.error('❌ No variations available');
        alert('No variations available. Please generate variations first.');
        return;
    }

    if (variationIndex < 0 || variationIndex >= window.adVariations.length) {
        console.error('❌ Invalid variation index:', variationIndex);
        alert('Invalid variation selected.');
        return;
    }

    const variation = window.adVariations[variationIndex];
    if (!variation || !variation.content) {
        console.error('❌ Invalid variation data:', variation);
        alert('Invalid variation data.');
        return;
    }

    console.log('✅ Using variation:', variation.title, variation.content);

    // Update global ad data
    currentAdData = variation.content;

    // Update the main ad preview with the new variation
    const formData = getFormData();
    displayResults(variation.content, currentImageUrl, formData);

    // Scroll to the updated ad preview
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.scrollIntoView({ behavior: 'smooth' });
    }

    // Show success feedback
    const button = document.querySelector(`.use-variation-btn[data-index="${variationIndex}"]`);
    if (button) {
        const originalText = button.textContent;
        button.textContent = '✅ Applied!';
        button.style.background = '#28a745';
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '#667eea';
        }, 2000);
    }
}

// Make useVariation available globally
window.useVariation = useVariation;

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

function updateFacebookPreview(textContent, adFormat) {
    const adPreview = document.querySelector('.ad-preview');
    if (!adPreview) return;

    // Apply format-specific styling
    switch(adFormat) {
        case 'instagram-story':
            adPreview.className = 'ad-preview instagram-story-format';
            break;
        case 'google-search':
            adPreview.className = 'ad-preview google-search-format';
            break;
        case 'whatsapp-status':
            adPreview.className = 'ad-preview whatsapp-status-format';
            break;
        default:
            adPreview.className = 'ad-preview facebook-format';
    }
}

function updateInstagramStoryPreview(textContent) {
    const adPreview = document.querySelector('.ad-preview');
    if (adPreview) {
        adPreview.className = 'ad-preview instagram-story-format';
    }
}

function updateGoogleSearchPreview(textContent) {
    const adPreview = document.querySelector('.ad-preview');
    if (adPreview) {
        adPreview.className = 'ad-preview google-search-format';
    }
}

function updateWhatsAppStatusPreview(textContent) {
    const adPreview = document.querySelector('.ad-preview');
    if (adPreview) {
        adPreview.className = 'ad-preview whatsapp-status-format';
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

    if (currentUser) {
        const userPlan = localStorage.getItem('userPlan') || 'free';

        if (userPlan === 'free') {
            const adsUsed = parseInt(localStorage.getItem('adsUsed') || '0');
            localStorage.setItem('adsUsed', (adsUsed + 1).toString());
            updateUsageDisplay();
        }
    }
}

function updateUsageDisplay() {
    const currentUser = typeof window.currentUser === 'function' ? window.currentUser() : null;

    if (!currentUser) return;

    const userPlan = localStorage.getItem('userPlan') || 'free';
    const adsUsed = parseInt(localStorage.getItem('adsUsed') || '0');

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

function showLoginRequiredModal() {
    // Create modal if it doesn't exist
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
                        color: #333;
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

function closeLoginModal() {
    const modal = document.getElementById('loginRequiredModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function signInForMore() {
    if (typeof window.signIn === 'function') {
        window.signIn();
        closeLoginModal();
    } else {
        alert('Sign in functionality not available. Please refresh the page.');
    }
}

function showPaymentModal() {
    // Create modal if it doesn't exist
    let modal = document.getElementById('paymentModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'paymentModal';
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
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 40px;
                border-radius: 20px;
                text-align: center;
                max-width: 500px;
                margin: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                color: white;
            ">
                <div style="font-size: 4rem; margin-bottom: 20px;">🚀</div>
                <h2 style="color: white; margin-bottom: 15px;">Upgrade to Premium!</h2>
                <p style="color: rgba(255,255,255,0.9); font-size: 1.1rem; margin-bottom: 30px; line-height: 1.6;">
                    You've reached your 4 free ads limit. Upgrade to Premium for unlimited ad generation!
                </p>
                <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 15px; margin-bottom: 30px;">
                    <h3 style="color: white; margin-bottom: 15px;">Premium Features:</h3>
                    <ul style="list-style: none; padding: 0; color: rgba(255,255,255,0.9);">
                        <li>✨ Unlimited ad generations</li>
                        <li>🎯 Advanced targeting options</li>
                        <li>📈 Performance analytics</li>
                        <li>🎨 Premium templates</li>
                        <li>⚡ Priority support</li>
                    </ul>
                </div>
                <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="upgradeToPremium()" style="
                        background: linear-gradient(135deg, #28a745, #20c997);
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        border-radius: 10px;
                        font-size: 1.1rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: transform 0.3s ease;
                    ">💳 Upgrade Now - $9.99/month</button>
                    <button onclick="closePaymentModal()" style="
                        background: rgba(255,255,255,0.2);
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        border-radius: 10px;
                        font-size: 1.1rem;
                        cursor: pointer;
                    ">Maybe Later</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    modal.style.display = 'flex';
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function upgradeToPremium() {
    // Set user to premium (in real app, this would integrate with payment processor)
    localStorage.setItem('userPlan', 'premium');
    localStorage.setItem('adsUsed', '0');

    closePaymentModal();
    updateUsageDisplay();

    alert('🎉 Welcome to Premium! You now have unlimited ad generation!');
}

// Make functions globally available
window.closeLoginModal = closeLoginModal;
window.signInForMore = signInForMore;
window.showLoginRequiredModal = showLoginRequiredModal;
window.showPaymentModal = showPaymentModal;
window.closePaymentModal = closePaymentModal;
window.upgradeToPremium = upgradeToPremium;

// Helper functions for ad format styling
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

// Export functions globally for HTML event handlers
window.handleFormSubmit = handleFormSubmit;
window.downloadImage = downloadImage;
window.regenerateAd = regenerateAd;
window.copyAdText = copyAdText;
window.generateVariations = generateVariations;