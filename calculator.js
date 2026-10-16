function calculateTaxBases(value, weight, entryType, isFirstEntry, stayedOver24h, entryFrequency) {
    let dutyBase = 0;
    let pureVatBase = 0;
    let explanation = "";

    if (entryType === "air") {
        if (isFirstEntry === "yes") {
            if (value <= 1000) {
                dutyBase = 0;
                pureVatBase = 0;
                explanation = "АВІА: Перший в'їзд за добу (до 1000 євро) — звільнено від мита та ПДВ.";
            } else {
                dutyBase = value - 1000;
                pureVatBase = value - 1000;
                explanation = "АВІА: Перший в'їзд за добу понад 1000 євро — нараховується на суму перевищення.";
            }
        } else {
            dutyBase = value;
            pureVatBase = value;
            explanation = "АВІА: В'їзд частіше 1 разу на добу — нараховується на повну вартість.";
        }
    } else { // Land / Water
        const weightExcess = Math.max(weight - 50, 0);
        const weightProportion = weight > 0 ? (weightExcess / weight) : 0;
        const weightBasedValue = value * weightProportion;

        if (isFirstEntry === "yes") {
            // МИТО (ч. 1 ст. 374 МКУ): Перший в'їзд за добу -> Ліміт мита 500 євро / 50 кг
            const valueExcessDuty = Math.max(value - 500, 0);
            dutyBase = Math.max(valueExcessDuty, weightBasedValue);

            if (stayedOver24h === "yes" && entryFrequency === "less") {
                // ПДВ (п. 191.2.3 ПКУ): Правило 24/72 виконано -> Ліміт ПДВ 500 євро
                pureVatBase = dutyBase;
                if (dutyBase === 0) {
                    explanation = "Виконано всі умови (в'їзд рідше 1 разу/добу, відсутність > 24 год, рідше 1 разу/72 год). Товар до 500 євро та 50 кг звільнено від мита та ПДВ.";
                } else {
                    explanation = "Виконано всі умови. Мито та ПДВ нараховуються на перевищення ліміту 500 євро або пропорцію ваги понад 50 кг.";
                }
            } else {
                // ПДВ (п. 191.2.3 ПКУ): Відсутність < 24 год або в'їзд частіше 1 разу/72 год -> Ліміт ПДВ 50 євро
                const valueExcessVAT = Math.max(value - 50, 0);
                pureVatBase = Math.max(valueExcessVAT, weightBasedValue);
                
                explanation = "В'їзд рідше 1 разу за добу (мито рахується від ліміту 500 євро). Проте перебування за кордоном < 24 год або в'їзд частіше 1 разу на 72 год (згідно з п. 191.2.3 ПКУ ліміт ПДВ падає до 50 євро).";
            }
        } else {
            // МИТО (ч. 2 ст. 374 МКУ): В'їзд частіше 1 разу за добу -> Мито на ПОВНУ вартість (без пільги)
            dutyBase = value; 
            
            // ПДВ: оскільки в'їзд частіше 1 разу за добу, особа була за кордоном < 24 год -> Ліміт ПДВ 50 євро
            const valueExcessVAT = Math.max(value - 50, 0);
            pureVatBase = Math.max(valueExcessVAT, weightBasedValue);

            explanation = "В'їзд частіше 1 разу на добу (ч. 2 ст. 374 МКУ): мито нараховується на ПОВНУ вартість (10%). ПДВ нараховується на вартість понад 50 євро з урахуванням нарахованого мита.";
        }
    }

    return { dutyBase, pureVatBase, explanation };
}
