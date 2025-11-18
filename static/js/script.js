const domRefs = {
	insightsList: null,
	predictionResultMain: null,
	predictionResultAlt: null,
	runMeta: null,
	sampleStatus: null,
	sampleProfile: null,
};

const currencyFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
let formsHydrated = false;

document.addEventListener('DOMContentLoaded', () => {
	captureDomRefs();
	const dashboardCharts = document.querySelector('[data-charts]');
	if (dashboardCharts) {
		loadSampleDashboard();
		document.getElementById('refresh-dashboard')?.addEventListener('click', loadSampleDashboard);
		const predForm = document.getElementById('prediction-form');
		if (predForm) {
			predForm.addEventListener('submit', (e) => submitPrediction(e));
			setupDisposableIncomeCalculation(predForm);
		}
	}

	const inputForm = document.getElementById('input-form');
	if (inputForm) {
		loadSampleDashboard();
		inputForm.addEventListener('submit', (e) => submitPrediction(e));
		setupDisposableIncomeCalculation(inputForm);
	}
});

function captureDomRefs(){
	domRefs.insightsList = document.getElementById('insights-list');
	domRefs.predictionResultMain = document.getElementById('prediction-result');
	domRefs.predictionResultAlt = document.getElementById('prediction-result-alt');
	domRefs.runMeta = document.getElementById('run-meta');
	domRefs.sampleStatus = document.getElementById('sample-status');
	domRefs.sampleProfile = document.getElementById('sample-profile');
}

function setupDisposableIncomeCalculation(form) {
	const incomeInput = form.querySelector('[name="Income"]');
	const expensesInput = form.querySelector('[name="Total_Expenses"]');
	const disposableInput = form.querySelector('[name="Disposable_Income"]');
	
	if (!incomeInput || !expensesInput || !disposableInput) return;
	
	// Make disposable income read-only
	disposableInput.readOnly = true;
	disposableInput.style.backgroundColor = '#1a1a1a';
	disposableInput.style.cursor = 'not-allowed';
	
	function updateDisposableIncome() {
		const income = parseFloat(incomeInput.value) || 0;
		const expenses = parseFloat(expensesInput.value) || 0;
		const disposable = Math.max(0, income - expenses);
		disposableInput.value = disposable;
	}
	
	// Calculate on input change
	incomeInput.addEventListener('input', updateDisposableIncome);
	expensesInput.addEventListener('input', updateDisposableIncome);
	
	// Initial calculation
	updateDisposableIncome();
	
	// Setup real-time expense warnings
	setupExpenseWarnings(form);
}

function setupExpenseWarnings(form) {
	const incomeInput = form.querySelector('[name="Income"]');
	const cityTierSelect = form.querySelector('[name="City_Tier"]');
	
	// Get all expense input fields
	const expenseFields = {
		'Rent': form.querySelector('[name="Rent"]'),
		'Loan_Repayment': form.querySelector('[name="Loan_Repayment"]'),
		'Insurance': form.querySelector('[name="Insurance"]'),
		'Groceries': form.querySelector('[name="Groceries"]'),
		'Transport': form.querySelector('[name="Transport"]'),
		'Eating_Out': form.querySelector('[name="Eating_Out"]'),
		'Entertainment': form.querySelector('[name="Entertainment"]'),
		'Utilities': form.querySelector('[name="Utilities"]'),
		'Healthcare': form.querySelector('[name="Healthcare"]'),
		'Education': form.querySelector('[name="Education"]'),
		'Miscellaneous': form.querySelector('[name="Miscellaneous"]')
	};
	
	// City-tier specific recommendations
	const getCityRecommendations = (cityTier) => {
		const recommendations = {
			'Tier 1': {
				'Rent': 35, 'Transport': 12, 'Eating_Out': 6, 'Groceries': 12,
				'Utilities': 6, 'Entertainment': 6, 'Loan_Repayment': 10, 'Insurance': 5,
				'Healthcare': 5, 'Education': 5, 'Miscellaneous': 5
			},
			'Tier 2': {
				'Rent': 28, 'Transport': 10, 'Eating_Out': 5, 'Groceries': 10,
				'Utilities': 5, 'Entertainment': 5, 'Loan_Repayment': 10, 'Insurance': 5,
				'Healthcare': 5, 'Education': 5, 'Miscellaneous': 5
			},
			'Tier 3': {
				'Rent': 20, 'Transport': 7, 'Eating_Out': 4, 'Groceries': 8,
				'Utilities': 4, 'Entertainment': 4, 'Loan_Repayment': 10, 'Insurance': 5,
				'Healthcare': 5, 'Education': 5, 'Miscellaneous': 5
			}
		};
		return recommendations[cityTier] || recommendations['Tier 2'];
	};
	
	// Advice messages for overspending
	const getAdviceMessage = (category, cityTier) => {
		const adviceMap = {
			'Rent': cityTier === 'Tier 1' 
				? 'Consider suburbs, co-living, or roommates in metro areas'
				: 'Consider relocating to cheaper areas or finding roommates',
			'Loan_Repayment': 'High debt burden. Consider debt consolidation, balance transfer, or longer tenure to reduce EMI.',
			'Insurance': 'Review your policies. You may be over-insured (high premiums) or under-insured (inadequate coverage).',
			'Groceries': cityTier === 'Tier 1'
				? 'Shop at wholesale markets (D-Mart, Metro), use shopping lists, buy in bulk, reduce food waste'
				: 'Buy seasonal produce, local markets cheaper than supermarkets, reduce packaged foods',
			'Transport': cityTier === 'Tier 1'
				? 'Use metro/local trains instead of cabs. Monthly passes save 40-50%. Carpool via apps.'
				: 'Use public transport, carpool with colleagues, bike for short distances, avoid solo cabs',
			'Eating_Out': cityTier === 'Tier 1'
				? 'Meal prep at home saves 50-70%. Office lunches = ₹200-300/day waste. Cook bulk on weekends.'
				: 'Home cooking saves 60-80%. Limit restaurants to 1-2x/month. Pack office lunch.',
			'Entertainment': cityTier === 'Tier 1'
				? 'Free city events, parks, museums on discount days. Shared OTT subscriptions. Cancel unused memberships.'
				: 'Explore free local activities, community events, libraries. Cancel unused streaming services.',
			'Utilities': cityTier === 'Tier 1'
				? 'AC optimization saves ₹1000-2000/month. LED lights, unplug devices, 5-star rated appliances.'
				: 'LED bulbs save 75% electricity. Optimize geyser usage. Unplug chargers. Check for leaks.',
			'Healthcare': 'Review health insurance adequacy. Preventive care saves lakhs later. Generic medicines 50-80% cheaper.',
			'Education': 'Explore online courses (Coursera, Udemy 90% off sales), scholarships, employer reimbursement programs.',
			'Miscellaneous': 'Track ALL expenses for 1 month - identify impulse buys. 24-hour rule for purchases >₹1000. Cut subscriptions.'
		};
		return adviceMap[category] || 'Consider reducing this expense category';
	};
	
	function showWarning(field, message, status) {
		// Remove existing warning if any
		removeWarning(field);
		
		// Create warning element
		const warning = document.createElement('div');
		warning.className = `expense-warning expense-warning-${status}`;
		warning.innerHTML = `
			<span class="warning-icon">${status === 'high' ? '🔴' : status === 'moderate' ? '🟡' : '🟢'}</span>
			<span class="warning-text">${message}</span>
		`;
		
		// Insert after the input field
		field.parentNode.insertBefore(warning, field.nextSibling);
		
		// Update field border color
		if (status === 'high') {
			field.style.borderColor = '#ff4444';
		} else if (status === 'moderate') {
			field.style.borderColor = '#ffaa00';
		} else {
			field.style.borderColor = '#00ff88';
		}
	}
	
	function removeWarning(field) {
		const existingWarning = field.parentNode.querySelector('.expense-warning');
		if (existingWarning) {
			existingWarning.remove();
		}
		field.style.borderColor = '';
	}
	
	function checkExpenseField(category, field) {
		const income = parseFloat(incomeInput.value) || 0;
		const amount = parseFloat(field.value) || 0;
		const cityTier = cityTierSelect ? cityTierSelect.value : 'Tier 2';
		
		if (income === 0 || amount === 0) {
			removeWarning(field);
			return;
		}
		
		const recommendations = getCityRecommendations(cityTier);
		const recommendedPct = recommendations[category];
		const recommendedAmount = income * (recommendedPct / 100);
		const userPct = (amount / income) * 100;
		
		if (amount > recommendedAmount * 1.3) {
			// High - more than 30% above recommended
			const excess = amount - recommendedAmount;
			const advice = getAdviceMessage(category, cityTier);
			showWarning(field, 
				`⚠️ HIGH: ${userPct.toFixed(1)}% of income (Recommended: ${recommendedPct}%). Save ₹${excess.toFixed(0)}/month. ${advice}`,
				'high'
			);
		} else if (amount > recommendedAmount * 1.1) {
			// Moderate - 10-30% above recommended
			const excess = amount - recommendedAmount;
			showWarning(field,
				`⚠️ MODERATE: ${userPct.toFixed(1)}% of income (Recommended: ${recommendedPct}%). Can save ₹${excess.toFixed(0)}/month.`,
				'moderate'
			);
		} else {
			// Good
			showWarning(field,
				`✓ GOOD: ${userPct.toFixed(1)}% of income (within ${recommendedPct}% recommendation for ${cityTier})`,
				'good'
			);
		}
	}
	
	// Add event listeners to all expense fields
	Object.entries(expenseFields).forEach(([category, field]) => {
		if (field) {
			field.addEventListener('input', () => checkExpenseField(category, field));
			field.addEventListener('blur', () => checkExpenseField(category, field));
		}
	});
	
	// Re-check all fields when income or city tier changes
	if (incomeInput) {
		incomeInput.addEventListener('input', () => {
			Object.entries(expenseFields).forEach(([category, field]) => {
				if (field && field.value) {
					checkExpenseField(category, field);
				}
			});
		});
	}
	
	if (cityTierSelect) {
		cityTierSelect.addEventListener('change', () => {
			Object.entries(expenseFields).forEach(([category, field]) => {
				if (field && field.value) {
					checkExpenseField(category, field);
				}
			});
		});
	}
}

async function loadSampleDashboard(){
	setSampleStatus('Loading sample analytics…');
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000);
	try {
		const res = await fetch('/api/sample-dashboard', { signal: controller.signal });
		if (!res.ok) throw new Error('API error');
		const data = await res.json();
		renderCharts(data.charts);
		renderInsights(data.insights);
		populateSelects(data.options);
		renderSampleProfile(data.sample_profile);
		window.__dashboardLoaded = true;
		setSampleStatus('Updated just now');
	} catch (err) {
		console.error(err);
		if (err.name === 'AbortError') {
			setSampleStatus('Request timed out. Ensure the Flask server is running.');
		} else {
			setSampleStatus('Unable to load dashboard snapshot.');
		}
		renderSampleProfile(null);
		renderInsights(['Unable to load dashboard snapshot. Check Flask server.']);
	} finally {
		clearTimeout(timeoutId);
	}
}

function setSampleStatus(text){
	if (domRefs.sampleStatus) domRefs.sampleStatus.textContent = text || '';
}

function renderSampleProfile(profile){
	if (!domRefs.sampleProfile) return;
	if (!profile){
		domRefs.sampleProfile.textContent = '';
		return;
	}
	const pieces = [];
	if (typeof profile.Income === 'number') pieces.push(`Income ₹${currencyFormatter.format(profile.Income)}`);
	if (profile.Age !== undefined) pieces.push(`Age ${profile.Age}`);
	if (profile.Dependents !== undefined) pieces.push(`Dependents ${profile.Dependents}`);
	if (profile.City_Tier) pieces.push(profile.City_Tier);
	domRefs.sampleProfile.textContent = `Sample Data: ${pieces.join(' • ')}`;
	hydrateFormDefaults(profile);
}

function hydrateFormDefaults(profile){
	if (formsHydrated) return;
	const forms = [document.getElementById('prediction-form'), document.getElementById('input-form')].filter(Boolean);
	if (!forms.length) return;
	forms.forEach((form) => {
		Object.entries(profile).forEach(([key, value]) => {
			const field = form.querySelector(`[name="${key}"]`);
			if (field && field.type !== 'select-one') {
				field.value = value;
			}
		});
		if (profile.Occupation) {
			const occ = form.querySelector('select[name="Occupation"]');
			if (occ) {
				ensureOption(occ, profile.Occupation);
				occ.value = profile.Occupation;
			}
		}
		if (profile.City_Tier) {
			const city = form.querySelector('select[name="City_Tier"]');
			if (city) {
				ensureOption(city, profile.City_Tier);
				city.value = profile.City_Tier;
			}
		}
	});
	formsHydrated = true;
}

function ensureOption(selectEl, value){
	const exists = Array.from(selectEl.options).some((opt) => opt.value === value);
	if (!exists){
		const option = document.createElement('option');
		option.value = value;
		option.textContent = value;
		selectEl.appendChild(option);
	}
}

function populateSelects(options){
	if (!options) return;
	const occupationOptions = options.occupations || [];
	const cityOptions = options.city_tiers || [];
	const occSelects = [document.getElementById('occupation-select'), document.getElementById('occupation-select-alt')].filter(Boolean);
	const citySelects = [document.getElementById('city-select'), document.getElementById('city-select-alt')].filter(Boolean);
	occSelects.forEach(sel => {
		sel.innerHTML = '';
		occupationOptions.forEach((label, idx) => {
			const opt = document.createElement('option');
			opt.value = label;
			opt.textContent = label;
			if (idx === 0) opt.selected = true;
			sel.appendChild(opt);
		});
	});
	citySelects.forEach(sel => {
		sel.innerHTML = '';
		cityOptions.forEach((label, idx) => {
			const opt = document.createElement('option');
			opt.value = label;
			opt.textContent = label;
			if (idx === 0) opt.selected = true;
			sel.appendChild(opt);
		});
	});
}

function renderCharts(charts){
	if (!charts) return;
	renderScatter(charts.scatter);
	renderPie(charts.pie);
	renderBar(charts.bar);
	renderProjection(charts.projection);
	renderHeatmap(charts.heatmap);
}

function renderScatter(data){
	const mount = document.querySelector('#scatter-income-expenses .chart');
	if (!mount || !data) return;
	Plotly.react(mount, [{
		x: data.income,
		y: data.totalExpenses,
		text: data.cityTier,
		marker: { color: data.savingsPct, colorscale: 'Turbo', size: 10, showscale: true, colorbar: {title: 'Savings %'} },
		mode: 'markers',
		type: 'scatter',
	}], {
		template: 'plotly_dark',
		paper_bgcolor: 'rgba(0,0,0,0)',
		plot_bgcolor: 'rgba(0,0,0,0)',
		xaxis: { title: 'Income (₹)' },
		yaxis: { title: 'Total Expenses (₹)' },
		margin: { l: 50, r: 10, t: 10, b: 40 },
	}, {responsive: true});
}

function renderPie(data){
	const mount = document.querySelector('#pie-expenses .chart');
	if (!mount || !data) return;
	if (!data.labels?.length){
		mount.innerHTML = '<p class="muted">No expense columns detected.</p>';
		return;
	}
	Plotly.react(mount, [{
		labels: data.labels,
		values: data.values,
		type: 'pie',
		textinfo: 'label+percent',
		hole: 0.35,
	}], {
		template: 'plotly_dark',
		margin: { t: 10, b: 10 },
	}, {responsive: true});
}

function renderBar(data){
	const mount = document.querySelector('#bar-occupation-expense .chart');
	if (!mount || !data) return;
	Plotly.react(mount, [{
		x: data.labels,
		y: data.values,
		type: 'bar',
		marker: {color: '#25b3ff'},
	}], {
		template: 'plotly_dark',
		margin: { b: 80, t: 10 },
		xaxis: { tickangle: -35 },
		yaxis: { title: 'Avg Total Expenses (₹)' },
	}, {responsive: true});
}

function renderProjection(data){
	const mount = document.querySelector('#line-projection .chart');
	if (!mount || !data) return;
	Plotly.react(mount, [{
		x: data.months,
		y: data.values,
		mode: 'lines+markers',
		line: {color: '#0af5ff'},
		marker: {color: '#25b3ff'},
	}], {
		template: 'plotly_dark',
		xaxis: { title: 'Month' },
		yaxis: { title: 'Projected Savings (₹)' },
		margin: { t: 10, l: 60, r: 20, b: 40 },
	}, {responsive: true});
}

function renderHeatmap(data){
	const mount = document.querySelector('#heatmap-corr .chart');
	if (!mount || !data) return;
	if (!data.labels?.length){
		mount.innerHTML = '<p class="muted">No numeric columns for heatmap.</p>';
		return;
	}
	Plotly.react(mount, [{
		z: data.matrix,
		x: data.labels,
		y: data.labels,
		type: 'heatmap',
		colorscale: 'RdBu',
		zmin: -1,
		zmax: 1,
	}], {
		template: 'plotly_dark',
		margin: { t: 10, b: 40 },
	}, {responsive: true});
}

function showInsightsLoading() {
	const loadingEl = document.getElementById('insights-loading');
	if (loadingEl) loadingEl.style.display = 'block';
	if (domRefs.insightsList) domRefs.insightsList.style.display = 'none';
}

function hideInsightsLoading() {
	const loadingEl = document.getElementById('insights-loading');
	if (loadingEl) loadingEl.style.display = 'none';
	if (domRefs.insightsList) domRefs.insightsList.style.display = 'flex';
}

function clearPreviousResults() {
	// Clear prediction results
	const targetMain = domRefs.predictionResultMain;
	const targetAlt = domRefs.predictionResultAlt;
	if (targetMain) targetMain.innerHTML = '<p class="muted">Processing...</p>';
	if (targetAlt) targetAlt.innerHTML = '<p class="muted">Processing...</p>';
	
	// Clear runtime
	const runtimeEl = document.getElementById('notebook-runtime');
	const runtimeAltEl = document.getElementById('notebook-runtime-alt');
	if (runtimeEl) runtimeEl.textContent = '';
	if (runtimeAltEl) runtimeAltEl.textContent = '';
	
	// Clear recommendations
	const mainRecommendations = document.getElementById('recommendations');
	const altRecommendations = document.getElementById('recommendations-alt');
	if (mainRecommendations) mainRecommendations.style.display = 'none';
	if (altRecommendations) altRecommendations.style.display = 'none';
	
	// Clear expense breakdown
	const mainExpenses = document.getElementById('expense-breakdown');
	const altExpenses = document.getElementById('expense-breakdown-alt');
	if (mainExpenses) mainExpenses.style.display = 'none';
	if (altExpenses) altExpenses.style.display = 'none';
}

function renderInsights(items){
	if (!domRefs.insightsList) return;
	domRefs.insightsList.innerHTML = '';
	(items || []).forEach(text => {
		const li = document.createElement('li');
		li.textContent = text;
		domRefs.insightsList.appendChild(li);
	});
	hideInsightsLoading();
}

async function submitPrediction(event){
	event.preventDefault();
	const form = event.target;
	const payload = buildPayload(form);
	
	// Clear previous results immediately
	clearPreviousResults();
	
	// Show loading in insights panel
	showInsightsLoading();
	
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
	
	try {
		const res = await fetch('/api/run-notebook', {
			method: 'POST',
			headers: {'Content-Type':'application/json'},
			body: JSON.stringify(payload),
			signal: controller.signal
		});
		clearTimeout(timeoutId);
		
		const data = await res.json();
		if (!res.ok || data.error){
			throw new Error(data.error || 'Notebook execution failed');
		}
		updatePredictionUI(data);
	} catch (err) {
		console.error(err);
		clearTimeout(timeoutId);
		updatePredictionUI({ error: err.message || 'An error occurred' });
	} finally {
		hideInsightsLoading();
	}
}

function buildPayload(form){
	const fd = new FormData(form);
	const payload = {};
	fd.forEach((value, key) => { payload[key] = value; });
	// Parse numeric fields
	const numericFields = [
		'Income','Age','Dependents','Total_Expenses','Desired_Savings_Percentage','Disposable_Income',
		'Rent','Loan_Repayment','Insurance','Groceries','Transport','Eating_Out',
		'Entertainment','Utilities','Healthcare','Education','Miscellaneous'
	];
	numericFields.forEach(key => {
		if (payload[key] !== undefined) {
			const val = parseFloat(payload[key]);
			payload[key] = isNaN(val) ? 0 : val;
		}
	});
	return payload;
}

function updatePredictionUI(data){
	const targetMain = domRefs.predictionResultMain;
	const targetAlt = domRefs.predictionResultAlt;
	const content = buildPredictionMarkup(data);
	if (targetMain) targetMain.innerHTML = content;
	if (targetAlt) targetAlt.innerHTML = content;
	
	// Show runtime only in insights section (both main and alt pages)
	const runtimeEl = document.getElementById('notebook-runtime');
	const runtimeAltEl = document.getElementById('notebook-runtime-alt');
	if (data.elapsed_ms) {
		const runtimeText = `Notebook runtime: ${data.elapsed_ms} ms`;
		if (runtimeEl) runtimeEl.textContent = runtimeText;
		if (runtimeAltEl) runtimeAltEl.textContent = runtimeText;
	}
	
	// Clear the run-meta if it exists (remove duplicate)
	if (domRefs.runMeta) domRefs.runMeta.textContent = '';
	
	// Update charts if provided (this ensures charts reflect user input)
	if (data.charts) {
		const dashboardCharts = document.querySelector('[data-charts]');
		if (dashboardCharts) {
			renderCharts(data.charts);
		}
	}
	
	// Update insights if provided
	if (data.insights) {
		renderInsights(data.insights);
	}
	
	// Update expense breakdown if provided
	if (data.expense_breakdown) {
		renderExpenseBreakdown(data.expense_breakdown);
	}
	
	// Update recommendations if provided
	if (data.recommendations) {
		renderRecommendations(data.recommendations);
	}
}

function buildPredictionMarkup(data){
	if (data.error){
		return `<p class="muted">${data.error}</p>`;
	}
	const pred = data.predicted_desired_savings ? Number(data.predicted_desired_savings).toLocaleString('en-IN') : 'N/A';
	const desired = data.desired_savings_amount ? Number(data.desired_savings_amount).toLocaleString('en-IN') : null;
	const shortfall = data.shortfall && data.shortfall > 0 ? Number(data.shortfall).toLocaleString('en-IN') : null;
	const prob = typeof data.overspend_probability === 'number' ? `${(data.overspend_probability * 100).toFixed(1)}%` : 'N/A';
	
	let shortfallText = '';
	if (shortfall && desired) {
		shortfallText = `<p class="shortfall-warning">⚠️ Shortfall: ₹${shortfall}/month below your ₹${desired} goal</p>`;
	}
	
	return `
		<h4>Predicted Desired Savings</h4>
		<p><strong>₹${pred}</strong> per month</p>
		${shortfallText}
		<p>Overspend probability: <strong>${prob}</strong></p>
	`;
}



function renderExpenseBreakdown(breakdown){
	const mainContainer = document.getElementById('expense-breakdown');
	const altContainer = document.getElementById('expense-breakdown-alt');
	const mainCategories = document.getElementById('expense-categories');
	const altCategories = document.getElementById('expense-categories-alt');
	
	if (!breakdown || !breakdown.categories || breakdown.categories.length === 0) {
		if (mainContainer) mainContainer.style.display = 'none';
		if (altContainer) altContainer.style.display = 'none';
		return;
	}
	
	const html = breakdown.categories.map(cat => {
		const statusClass = cat.status.includes('\uD83D\uDD34') ? 'status-high' : 
		                    cat.status.includes('\uD83D\uDFE1') ? 'status-moderate' : 'status-good';
		return `
			<div class="expense-category ${statusClass}">
				<div class="category-header">
					<h5>${cat.category}</h5>
					<span class="status-badge">${cat.status}</span>
				</div>
				<div class="category-details">
					<div class="detail-row">
						<span>Current:</span>
						<strong>₹${cat.current_amount.toLocaleString('en-IN')} (${cat.current_percentage}%)</strong>
					</div>
					<div class="detail-row">
						<span>Recommended:</span>
						<span>₹${cat.recommended_amount.toLocaleString('en-IN')} (${cat.recommended_percentage}%)</span>
					</div>
					<div class="detail-row">
						<span>${breakdown.city_tier || 'City'} Average:</span>
						<span>₹${cat.city_tier_average.toLocaleString('en-IN')}</span>
					</div>
					${cat.potential_saving > 0 ? `
					<div class="detail-row saving">
						<span>💰 Potential Saving:</span>
						<strong>₹${cat.potential_saving.toLocaleString('en-IN')}/month</strong>
					</div>` : ''}
				</div>
				<div class="category-advice">
					${cat.advice.map(a => `<p>${a}</p>`).join('')}
				</div>
			</div>
		`;
	}).join('');
	
	const summaryHtml = `
		<div class="breakdown-summary">
			<p><strong>${breakdown.summary}</strong></p>
			${breakdown.total_potential_savings > 0 ? 
				`<p class="highlight">Annual potential: ₹${(breakdown.total_potential_savings * 12).toLocaleString('en-IN')}</p>` : ''}
		</div>
	`;
	
	if (mainCategories) {
		mainCategories.innerHTML = summaryHtml + html;
		mainContainer.style.display = 'block';
	}
	if (altCategories) {
		altCategories.innerHTML = summaryHtml + html;
		altContainer.style.display = 'block';
	}
}

function renderRecommendations(recommendations){
	const mainList = document.getElementById('recommendations-list');
	const altList = document.getElementById('recommendations-list-alt');
	const mainPanel = document.getElementById('recommendations');
	const altPanel = document.getElementById('recommendations-alt');
	
	if (!recommendations || recommendations.length === 0) {
		if (mainPanel) mainPanel.style.display = 'none';
		if (altPanel) altPanel.style.display = 'none';
		return;
	}
	
	// Enhanced rendering with better formatting for sections
	const html = recommendations.map(rec => {
		// Skip separator lines and empty lines
		if (!rec.trim() || rec.includes('====') || rec.match(/^=+$/)) {
			return '';
		}
		
		// Section headers (Unicode symbols with ALL CAPS)
		if (rec.match(/^[\u25A0\u25B6\u25C6\u2713\u26A0\u2717\u2192]+\s+[A-Z\s&]+$/)) {
			return `<li class="recommendation-section-header">${rec}</li>`;
		}
		
		// Sub-headers with Unicode symbols
		if (rec.match(/^\s*[\u25C6\u25B6\u2192\u2713\u26A0]+\s/)) {
			return `<li class="recommendation-subheader">${rec}</li>`;
		}
		
		// Indented items (start with spaces or bullet)
		if (rec.match(/^\s{2,}[•\u2022]/) || rec.match(/^\s{2,}\d+\./)) {
			return `<li class="recommendation-detail">${rec.trim()}</li>`;
		}
		
		// Regular items
		return `<li class="recommendation-item">${rec}</li>`;
	}).filter(item => item !== '').join('');
	
	if (mainList) {
		mainList.innerHTML = html;
		mainPanel.style.display = 'block';
	}
	if (altList) {
		altList.innerHTML = html;
		altPanel.style.display = 'block';
	}
}

