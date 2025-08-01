// Payment configuration
let RAZORPAY_KEY_ID = '';
let RAZORPAY_KEY_SECRET = '';

// Load Razorpay configuration
async function loadRazorpayConfig() {
    try {
        let retries = 0;
        while (!window.CONFIG && retries < 100) {
            await new Promise(resolve => setTimeout(resolve, 200));
            retries++;
        }

        if (window.CONFIG) {
            RAZORPAY_KEY_ID = window.CONFIG.RAZORPAY_KEY_ID || '';
            RAZORPAY_KEY_SECRET = window.CONFIG.RAZORPAY_KEY_SECRET || '';

            console.log('💳 Razorpay config loaded:', {
                hasKeyId: !!RAZORPAY_KEY_ID,
                hasKeySecret: !!RAZORPAY_KEY_SECRET,
                keyIdLength: RAZORPAY_KEY_ID ? RAZORPAY_KEY_ID.length : 0
            });

            // Validate that keys are properly loaded
            if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID.length < 10) {
                console.error('❌ Invalid Razorpay Key ID');
                return false;
            }
            return true;
        } else {
            console.error('❌ CONFIG not available after waiting');
            return false;
        }
    } catch (error) {
        console.error('❌ Failed to load Razorpay config:', error);
        return false;
    }
}

// Subscription plans
const SUBSCRIPTION_PLANS = {
    free: {
        name: 'Free',
        price: 0,
        adsPerMonth: 4,
        features: ['4 ads per month', 'Basic templates', 'Standard support']
    },
    pro: {
        name: 'Pro',
        price: 59900, // ₹599 in paise
        priceUSD: 799, // $7.99 in cents
        adsPerMonth: 100,
        features: ['100 ads per month', 'Premium templates', 'Priority support', 'Advanced analytics']
    },
    unlimited: {
        name: 'Unlimited',
        price: 99900, // ₹999 in paise
        priceUSD: 1299, // $12.99 in cents
        adsPerMonth: -1,
        features: ['Unlimited ads', 'All premium features', '24/7 support', 'Custom branding', 'API access']
    }
};

// Detect user's country/currency
function getUserCurrency() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const isIndian = timezone.includes('Asia/Kolkata') || timezone.includes('Asia/Calcutta');
    return isIndian ? 'INR' : 'USD';
}

// Format price based on currency
function formatPrice(plan, currency) {
    if (plan.price === 0) return 'Free';

    if (currency === 'INR') {
        return `₹${(plan.price / 100).toFixed(0)}/month`;
    } else {
        return `$${(plan.priceUSD / 100).toFixed(2)}/month`;
    }
}

// Handle subscription
async function handleSubscription(planKey) {
    console.log('💳 Handling subscription for plan:', planKey);

    if (planKey === 'free') {
        alert('You are already on the free plan!');
        return;
    }

    // Ensure config is loaded before proceeding
    const configLoaded = await loadRazorpayConfig();
    if (!configLoaded || !RAZORPAY_KEY_ID || RAZORPAY_KEY_ID.length < 10) {
        console.error('❌ Razorpay configuration not available');
        console.log('❌ Current config state:', {
            configExists: !!window.CONFIG,
            keyId: RAZORPAY_KEY_ID ? `${RAZORPAY_KEY_ID.substring(0, 8)}...` : 'none',
            keyLength: RAZORPAY_KEY_ID ? RAZORPAY_KEY_ID.length : 0
        });
        alert('Payment system is still loading. Please wait a moment and try again.');
        return;
    }

    const plan = SUBSCRIPTION_PLANS[planKey];
    const currency = getUserCurrency();
    const amount = currency === 'INR' ? plan.price : plan.priceUSD;

    const user = typeof window.currentUser === 'function' ? window.currentUser() : null;
    if (!user) {
        alert('Please sign in to subscribe');
        return;
    }

    try {
        // Create Razorpay order
        const orderResponse = await fetch('/api/create-razorpay-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: amount,
                currency: currency,
                planKey: planKey,
                userId: user.uid
            })
        });

        const orderData = await orderResponse.json();

        if (!orderData.success) {
            throw new Error(orderData.error || 'Failed to create order');
        }

        // Initialize Razorpay payment
        const options = {
            key: RAZORPAY_KEY_ID,
            amount: amount,
            currency: currency,
            name: 'Facebook Ad Generator',
            description: `${plan.name} Plan Subscription`,
            order_id: orderData.orderId,
            handler: function(response) {
                verifyPayment(response, planKey, user.uid);
            },
            prefill: {
                name: user.displayName || user.email,
                email: user.email
            },
            theme: {
                color: '#667eea'
            },
            modal: {
                ondismiss: function() {
                    console.log('Payment modal closed');
                }
            }
        };

        const razorpay = new Razorpay(options);
        razorpay.open();

    } catch (error) {
        console.error('❌ Payment error:', error);
        alert('Payment failed. Please try again.');
    }
}

// Verify payment
async function verifyPayment(paymentResponse, planKey, userId) {
    try {
        const response = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...paymentResponse,
                planKey: planKey,
                userId: userId
            })
        });

        const result = await response.json();

        if (result.success) {
            alert('🎉 Payment successful! Your subscription is now active.');

            // Update current user
            if (typeof window.currentUser === 'function') {
                const user = window.currentUser();
                if (user) {
                    user.subscriptionStatus = planKey;
                    user.usageCount = 0; // Reset usage count
                }
            }

            // Close payment modal
            const modal = document.getElementById('paymentModal');
            if (modal) {
                modal.style.display = 'none';
            }

            // Refresh page to update UI
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } else {
            throw new Error(result.error || 'Payment verification failed');
        }
    } catch (error) {
        console.error('❌ Payment verification error:', error);
        alert('Payment verification failed. Please contact support.');
    }
}

// Setup payment modal
function setupPaymentModal() {
    // Remove existing modal if it exists
    const existingModal = document.getElementById('paymentModal');
    if (existingModal) {
        existingModal.remove();
    }

    const userCurrency = getUserCurrency();

    // Create payment modal HTML
    const modalHTML = `
        <div id="paymentModal" class="payment-modal" style="display: none;">
            <div class="payment-modal-content">
                <span class="payment-close">&times;</span>
                <h2>🚀 Upgrade Your Plan</h2>
                <div class="pricing-grid">
                    ${Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => `
                        <div class="pricing-card ${key === 'pro' ? 'popular' : ''}" data-plan="${key}">
                            ${key === 'pro' ? '<div class="popular-badge">Most Popular</div>' : ''}
                            <h3>${plan.name}</h3>
                            <div class="price">
                                ${formatPrice(plan, userCurrency)}
                            </div>
                            <ul class="features">
                                ${plan.features.map(feature => `<li>✅ ${feature}</li>`).join('')}
                            </ul>
                            <button class="subscribe-btn ${key === 'free' ? 'free-plan' : ''}" 
                                    onclick="handleSubscription('${key}')" 
                                    ${key === 'free' ? 'disabled' : ''}>
                                ${key === 'free' ? 'Current Plan' : 'Subscribe Now'}
                            </button>
                            ${key !== 'free' ? `
                                <div style="margin-top: 15px; padding: 15px; border: 2px solid #667eea; border-radius: 12px; background: linear-gradient(135deg, #f8f9ff, #e6ebff);">
                                    <p style="margin: 0 0 15px 0; font-size: 1rem; color: #333; font-weight: 600; text-align: center;">⚡ Instant Payment</p>
                                    <button 
                                        class="razorpay-payment-btn" 
                                        onclick="handleSubscription('${key}')"
                                        style="background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; cursor: pointer; width: 100%;">
                                        💳 Pay Now - ${formatPrice(plan, userCurrency)}
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Setup modal events
    const modal = document.getElementById('paymentModal');
    const closeBtn = document.querySelector('.payment-close');

    closeBtn.onclick = () => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    };

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    };
}

// Show payment modal
function showPaymentModal() {
    console.log('💳 showPaymentModal called');

    // Force create modal if it doesn't exist
    setupPaymentModal();

    // Show the modal immediately
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.style.display = 'block';
        modal.style.zIndex = '10000';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        console.log('💳 Payment modal opened successfully');
    } else {
        console.error('❌ Payment modal creation failed, showing fallback alert');
        // Final fallback - show enhanced alert
        const upgradeMessage = `🎉 CONGRATULATIONS! You've reached your 4 FREE ads limit!

🚀 Ready to unlock UNLIMITED professional ads?

💎 PRO PLAN - ₹599/month
✅ 100 Professional Ads per month
✅ Premium Templates & Designs
✅ Priority Customer Support
✅ Advanced Analytics

⭐ UNLIMITED PLAN - ₹999/month  
✅ UNLIMITED Ad Generation
✅ All Premium Features
✅ 24/7 Priority Support
✅ Custom Branding Options
✅ API Access

Transform your business with unlimited AI-powered Facebook ads!

Click OK to continue with your current plan or refresh the page to upgrade.`;

        alert(upgradeMessage);
    }
}

// Check user subscription status
function checkUserSubscription() {
    const user = typeof window.currentUser === 'function' ? window.currentUser() : null;
    if (user) {
        console.log('👤 Current user subscription:', user.subscriptionStatus || 'free');
    }
}

// Make payment functions globally available
window.showPaymentModal = showPaymentModal;
window.handleSubscription = handleSubscription;

// Load config when available
document.addEventListener('DOMContentLoaded', function() {
    // Wait for config to be available before setting up payment
    const initPayment = async () => {
        console.log('💳 Initializing payment system...');
        const configLoaded = await loadRazorpayConfig();
        if (configLoaded) {
            console.log('✅ Payment system ready');
        } else {
            console.warn('⚠️ Payment system configuration incomplete');
        }
        setupPaymentModal();
        checkUserSubscription();
    };
    
    setTimeout(initPayment, 500);
});

console.log('✅ Payment module loaded successfully');