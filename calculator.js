document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('customsDutyForm');
    const resultDiv = document.getElementById('result');
    const additionalQuestions = document.getElementById('additionalQuestions');
    const stayedOver24hGroup = document.getElementById('stayedOver24hGroup');
    const entryFrequencyGroup = document.getElementById('entryFrequencyGroup');
    const stayedOver24hInputs = document.querySelectorAll('input[name="stayedOver24h"]');
    const entryFrequencyInputs = document.querySelectorAll('input[name="entryFrequency"]');
    
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Очистити форму';
    clearButton.type = 'button';
    clearButton.style.marginTop = '10px';
    form.appendChild(clearButton);

    const DUTY_RATE = 0.1;
    const VAT_RATE = 0.2;
    
    let exchangeRates = { 'UAH': 1 }; 

    fetchNBURates();

    document.querySelectorAll('input[name="entryType"], input[name="isFirstEntry"]').forEach(radio => {
        radio.addEventListener('change', updateFormVisibility);
    });

    clearButton.addEventListener('click', clearForm);

    async function fetchNBURates() {
        try {
            const response = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
            if (response.ok) {
                const data = await response.json();
                data.forEach(item => {
                    exchangeRates[item.cc] = item.rate;
                });
                console.log('Курси НБУ успішно завантажено. Курс EUR:', exchangeRates['EUR']);
            } else {
                console.error('Помилка сервера НБУ при завантаженні курсів.');
            }
        } catch (error) {
            console.error('Не вдалося з\'єднатися з сервером НБУ:', error);
        }
    }

    function updateFormVisibility() {
        const entryType = document.querySelector('input[name="entryType"]:checked').value;
        const isFirstEntry = document.querySelector('input[name="isFirstEntry"]:checked').value;

        if (entryType === 'air') {
            additionalQuestions.style.display = 'none';
            setAndDisableAdditionalQuestions(true);
        } else { // land
            if (isFirstEntry === 'yes') {
                additionalQuestions.style.display = 'block';
                stayedOver24hGroup.style.display = 'block';
                entryFrequencyGroup.style.display = 'block';
                setAndDisableAdditionalQuestions(false);
            } else {
                additionalQuestions.style.display = 'none';
                setAndDisableAdditionalQuestions(true);
            }
        }
    }

    function setAndDisableAdditionalQuestions(disable) {
        stayedOver24hInputs.forEach(input => {
            input.disabled = disable;
            if (disable) {
                input.checked = input.value === 'no';
            }
        });

        entryFrequencyInputs.forEach(input => {
            input.disabled = disable;
            if (disable) {
                input.checked = input.value === 'more';
            }
        });
    }

    function clearForm() {
        form.reset();
        resultDiv.classList.add('hidden');
        updateFormVisibility();
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        calculateDutyAndVAT();
    });

    function calculateDutyAndVAT() {
        const originalValue = parseFloat(document.getElementById('value').value);
        const selectedCurrency = document.getElementById('currency').value;
        const weight = parseFloat(document.getElementById('weight').value);
        const entryType = document.querySelector('input[name="entryType"]:checked').value;
        const isFirstEntry = document.querySelector('input[name="isFirstEntry"]:checked').value;
        const stayedOver24h = document.querySelector('input[name="stayedOver24h"]:checked').value;
        const entryFrequency = document.querySelector('input[name="entryFrequency"]:checked').value;

        if (isNaN(originalValue) || isNaN(weight) || originalValue < 0 || weight < 0) {
            alert("Будь ласка, введіть коректні додатні значення для вартості та ваги товарів.");
            return;
        }

        let valueInEur = originalValue;
        
        if (selectedCurrency !== 'EUR') {
            if (!exchangeRates['EUR'] || (!exchangeRates[selectedCurrency] && selectedCurrency !== 'UAH')) {
                alert("Курси валют ще завантажуються або наразі недоступні. Будь ласка, зачекайте секунду або введіть суму одразу в Євро.");
                return;
            }
            
            const valueInUah = originalValue * exchangeRates[selectedCurrency];
            valueInEur = valueInUah / exchangeRates['EUR'];
        }

        if (valueInEur > 10000) {
            alert(`Еквівалент вартості перевищує 10000 євро (${valueInEur.toFixed(2)} EUR). Такі товари підлягають письмовому декларуванню у порядку, передбаченому для підприємств.`);
            return;
        }

        // Отримуємо "чисті" бази (у євро)
        const { dutyBase, pureVatBase, explanation } = calculateTaxBases(valueInEur, weight, entryType, isFirstEntry, stayedOver24h, entryFrequency);
        
        const duty = dutyBase * DUTY_RATE;
        let vat = 0;
        let finalVatBase = 0;

        // Згідно з законами, до бази ПДВ додається нараховане мито
        if (pureVatBase > 0) {
            finalVatBase = pureVatBase + duty;
            vat = finalVatBase * VAT_RATE;
        }
        
        const totalPaymentEur = duty + vat;

        displayResults(originalValue, selectedCurrency, valueInEur, dutyBase, duty, finalVatBase, vat, totalPaymentEur, explanation);
    }

    function calculateTaxBases(value, weight, entryType, isFirstEntry, stayedOver24h, entryFrequency) {
        let dutyBase = 0;
        let pureVatBase = 0;
        let explanation = "";

        if (entryType === "air") {
            if (isFirstEntry === "yes") {
                if (value <= 1000) {
                    dutyBase = 0;
                    pureVatBase = 0;
                    explanation = "АВІА: Перший в'їзд за добу (вартість до 1000 євро) — мито та ПДВ не нараховуються.";
                } else {
                    dutyBase = value - 1000;
                    pureVatBase = value - 1000;
                    explanation = "АВІА: Перший в'їзд за добу з вартістю понад 1000 євро — мито та ПДВ нараховуються на суму перевищення.";
                }
            } else {
                dutyBase = value;
                pureVatBase = value;
                explanation = "АВІА: В'їзд частіше одного разу на добу — мито та ПДВ нараховуються на повну вартість товарів.";
            }
        } else { // land
            const weightExcess = Math.max(weight - 50, 0);
            const weightProportion = weight > 0 ? (weightExcess / weight) : 0;
            const weightBasedValue = value * weightProportion;

            if (isFirstEntry === "yes") {
                if (stayedOver24h === "yes" && entryFrequency === "less") {
                    // Умови "24/72" виконано -> Ліміт 500 євро та 50 кг
                    const valueExcess = Math.max(value - 500, 0);
                    dutyBase = Math.max(valueExcess, weightBasedValue);
                    pureVatBase = dutyBase;

                    if (dutyBase === 0) {
                        explanation = "Виконано правило «24/72» (відсутність > 24 год, в'їзд рідше 1 разу на 3 доби). Товари до 500 євро та 50 кг звільнені від оподаткування.";
                    } else {
                        explanation = "Виконано правило «24/72». База розрахована як більша з двох величин: перевищення вартості 500 євро АБО пропорція ваги понад 50 кг.";
                    }
                } else {
                    // Порушено "24/72" (відсутність < 24 год або частий в'їзд) -> Ліміт падає до 50 євро та 50 кг
                    const valueExcess = Math.max(value - 50, 0);
                    dutyBase = Math.max(valueExcess, weightBasedValue);
                    pureVatBase = dutyBase;

                    explanation = "Перший в'їзд за добу, але порушено правило «24/72» (відсутність менше 24 год або в'їзд частіше 1 разу на 3 доби). Ліміт знижено до 50 євро та 50 кг для мита і ПДВ. База обирається як більша з двох величин.";
                }
            } else {
                // В'їзд частіше 1 разу на ДОБУ (немає пільги на мито)
                dutyBase = value; // Мито на ПОВНУ вартість
                const valueExcessVAT = Math.max(value - 50, 0);
                pureVatBase = Math.max(valueExcessVAT, weightBasedValue);

                explanation = "В'їзд частіше 1 разу на добу. Мито нараховується на ПОВНУ вартість. База ПДВ розраховується з вартості, що перевищує 50 євро (з урахуванням мита) або пропорції ваги.";
            }
        }

        return { dutyBase, pureVatBase, explanation };
    }

    function displayResults(originalValue, currency, valueInEur, dutyBase, duty, vatBase, vat, totalPaymentEur, explanation) {
        const eurRate = exchangeRates['EUR'];
        
        let conversionHtml = '';
        if (currency !== 'EUR') {
            conversionHtml = `<p style="color: #555; font-size: 0.9em; margin-bottom: 15px;">
                <em>Введено: ${originalValue.toFixed(2)} ${currency} ≈ <strong>${valueInEur.toFixed(2)} EUR</strong> 
                (Крос-курс НБУ)</em>
            </p>`;
        } else {
            conversionHtml = `<p style="margin-bottom: 15px;">Заявлена вартість: <strong>${valueInEur.toFixed(2)} EUR</strong></p>`;
        }

        let uahBreakdownHtml = '';
        if (eurRate) {
            const dutyBaseUah = dutyBase * eurRate;
            const dutyUah = duty * eurRate;
            const vatBaseUah = vatBase * eurRate;
            const vatUah = vat * eurRate;
            const totalUah = totalPaymentEur * eurRate;

            uahBreakdownHtml = `
                <div style="background-color: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #e9ecef; margin: 10px 0; font-size: 0.95em;">
                    <p style="margin: 3px 0;"><strong>У гривнях за курсом НБУ (${eurRate.toFixed(4)} грн/EUR):</strong></p>
                    <p style="margin: 3px 0;">• Основа мита: <strong>${dutyBaseUah.toFixed(2)} грн</strong> → Мито (10%): <strong>${dutyUah.toFixed(2)} грн</strong></p>
                    <p style="margin: 3px 0;">• Основа ПДВ: <strong>${vatBaseUah.toFixed(2)} грн</strong> → ПДВ (20%): <strong>${vatUah.toFixed(2)} грн</strong></p>
                </div>
                <div style="background-color: #e6f7ff; padding: 10px; border-left: 4px solid #1890ff; margin: 15px 0;">
                    <p style="margin: 0; font-size: 1.1em;"><strong>До сплати в гривнях: ₴ ${totalUah.toFixed(2)}</strong></p>
                </div>
            `;
        } else {
            uahBreakdownHtml = `<p style="color: #d9363e; font-size: 0.9em;"><em>Не вдалося завантажити актуальний курс НБУ. Конвертація в гривню недоступна.</em></p>`;
        }

        // Відображаємо результати
        resultDiv.innerHTML = `
            <h3>Результат розрахунку:</h3>
            ${conversionHtml}
            <p>База оподаткування митом: ${dutyBase.toFixed(2)} EUR</p>
            <p>Мито (10%): ${duty.toFixed(2)} EUR</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">
            <p>База оподаткування ПДВ <em>(вкл. мито)</em>: ${vatBase.toFixed(2)} EUR</p>
            <p>ПДВ (20%): ${vat.toFixed(2)} EUR</p>
            <hr style="border: 0; border-top: 1px solid #ccc; margin: 15px 0;">
            <p style="font-size: 1.1em;"><strong>Загальна сума платежів: ${totalPaymentEur.toFixed(2)} EUR</strong></p>
            ${uahBreakdownHtml}
            <p style="background-color: #fffbe6; padding: 10px; border-left: 4px solid #faad14; font-size: 0.9em; margin-top: 15px;">
                <em><strong>Пояснення:</strong> ${explanation}</em>
            </p>
        `;

        resultDiv.classList.remove('hidden');
        resultDiv.style.opacity = '0';
        setTimeout(() => {
            resultDiv.style.transition = 'opacity 0.5s ease-in-out';
            resultDiv.style.opacity = '1';
        }, 10);
    }

    updateFormVisibility();
});