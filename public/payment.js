
// Payment configuration
const STRIPE_PUBLISHABLE_KEY = 'pk_test_your_stripe_key_here'; // Replace with your Stripe key
let stripe;

// Initialize Stripe when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (window.Stripe && STRIPE_PUBLISHABLE_KEY) {
        stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
    }
    setupPaymentModal();
    checkUserSubscription();
});

// Subscription plans
const SUBSCRIPTION_PLANS = {
    free: {
        name: 'Free',
        price: 0,
        adsPerMonth: 5,
        features: ['5 ads per month', 'Basic templates', 'Standard support']
    },
    pro: {
        name: 'Pro',
        price: 999, // ₹9.99 in paise
        adsPerMonth: 100,
        features: ['100 ads per month', 'Premium templates', 'Priority support', 'Advanced analytics']
    },
    unlimited: {
        name: 'Unlimited',
        price: 1999, // ₹19.99 in paise
        adsPerMonth: -1,
        features: ['Unlimited ads', 'All premium features', '24/7 support', 'Custom branding', 'API access']
    }
};

function setupPaymentModal() {
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
                                ${plan.price === 0 ? 'Free' : `₹${(plan.price / 100).toFixed(2)}/month`}
                            </div>
                            <ul class="features">
                                ${plan.features.map(feature => `<li>✅ ${feature}</li>`).join('')}
                            </ul>
                            <button class="subscribe-btn ${key === 'free' ? 'free-plan' : ''}" 
                                    onclick="handleSubscription('${key}')" 
                                    ${key === 'free' ? 'disabled' : ''}>
                                ${key === 'free' ? 'Current Plan' : 'Subscribe Now'}
                            </button>
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
    
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}

function showPaymentModal() {
    document.getElementById('paymentModal').style.display = 'block';
}

function checkUserSubscription() {
    // Check user's current subscription from localStorage
    const userPlan = localStorage.getItem('userPlan') || 'free';
    const adsUsed = parseInt(localStorage.getItem('adsUsed') || '0');
    const planLimits = SUBSCRIPTION_PLANS[userPlan];
    
    updateUsageDisplay(userPlan, adsUsed, planLimits.adsPerMonth);
    
    // Add usage info to header
    const header = document.querySelector('header');
    if (header && !document.querySelector('.usage-info')) {
        const usageHTML = `
            <div class="usage-info">
                <div class="plan-badge">${planLimits.name} Plan</div>
                <div class="usage-count">
                    ${planLimits.adsPerMonth === -1 ? 'Unlimited' : `${adsUsed}/${planLimits.adsPerMonth}`} ads used
                </div>
                ${userPlan === 'free' ? '<button onclick="showPaymentModal()" class="upgrade-btn">🚀 Upgrade</button>' : ''}
            </div>
        `;
        header.insertAdjacentHTML('beforeend', usageHTML);
    }
}

function updateUsageDisplay(plan, used, limit) {
    const usageCount = document.querySelector('.usage-count');
    if (usageCount) {
        usageCount.textContent = limit === -1 ? 'Unlimited' : `${used}/${limit} ads used`;
    }
}

function canGenerateAd() {
    const userPlan = localStorage.getItem('userPlan') || 'free';
    const adsUsed = parseInt(localStorage.getItem('adsUsed') || '0');
    const planLimits = SUBSCRIPTION_PLANS[userPlan];
    
    if (planLimits.adsPerMonth === -1) return true; // Unlimited
    
    return adsUsed < planLimits.adsPerMonth;
}

function incrementAdUsage() {
    const adsUsed = parseInt(localStorage.getItem('adsUsed') || '0');
    localStorage.setItem('adsUsed', (adsUsed + 1).toString());
    
    const userPlan = localStorage.getItem('userPlan') || 'free';
    updateUsageDisplay(userPlan, adsUsed + 1, SUBSCRIPTION_PLANS[userPlan].adsPerMonth);
}

async function handleSubscription(planKey) {
    if (planKey === 'free') return;
    
    const plan = SUBSCRIPTION_PLANS[planKey];
    
    if (!stripe) {
        alert('Payment system is not configured. Please contact support.');
        return;
    }
    
    try {
        // Create checkout session
        const response = await fetch('/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                planKey,
                planName: plan.name,
                price: plan.price
            })
        });
        
        const session = await response.json();
        
        if (session.error) {
            alert('Error creating checkout session: ' + session.error);
            return;
        }
        
        // Redirect to Stripe Checkout
        const result = await stripe.redirectToCheckout({
            sessionId: session.id
        });
        
        if (result.error) {
            alert('Payment failed: ' + result.error.message);
        }
        
    } catch (error) {
        console.error('Payment error:', error);
        alert('Payment failed. Please try again.');
    }
}

// Payment success handler
function handlePaymentSuccess(planKey) {
    localStorage.setItem('userPlan', planKey);
    localStorage.setItem('adsUsed', '0'); // Reset usage
    alert('🎉 Payment successful! Your plan has been upgraded.');
    location.reload();
}
