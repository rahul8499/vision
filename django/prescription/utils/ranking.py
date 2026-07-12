from decimal import Decimal

def calculate_quality_score(store, response, price_thresholds):
    """
    Advanced Ranking Engine v4 (Risk-Averaged Marketplace)
    - Gated Exploration Boost (Only for Reliable Stores)
    - Thresholded Conversion Metrics
    - Volume/Premium Sellers Boost
    """
    # Convert weights to Decimal to avoid TypeError with price_score
    W_PRICE = Decimal('0.25')
    W_AVAIL = Decimal('0.35')
    W_TIME = Decimal('0.20')
    W_RATING = Decimal('0.20')

    # 1. Price Score (25%)
    max_price = price_thresholds.get('max')
    min_price = price_thresholds.get('min')
    
    if max_price is None or min_price is None or max_price == min_price:
        price_score = Decimal('100.0')
    else:
        # Ensure Decimals for division
        max_p = Decimal(str(max_price))
        min_p = Decimal(str(min_price))
        curr_p = Decimal(str(response.total_amount))
        price_score = Decimal('100.0') * (Decimal('1.0') - (curr_p - min_p) / (max_p - min_p))
    
    # 🕵️ Anti-Gaming: Bait Price
    avail_scenario = (response.quotation_scenario or "PARTIAL").lower()
    if max_price and response.total_amount <= (Decimal(str(min_price)) * Decimal('1.2')) and avail_scenario == "partial":
        price_score *= Decimal('0.5')

    # 2. Availability Score (35%)
    avail_map = {
        'exact_brand': Decimal('100.0'), 
        'all_generic': Decimal('90.0'), 
        'mixed': Decimal('70.0'), 
        'substitutes': Decimal('60.0'), 
        'partial': Decimal('40.0')
    }
    avail_score = avail_map.get(avail_scenario, Decimal('40.0'))

    # 🕵️ Anti-Gaming: Stock Fraud
    if avail_scenario == 'exact_brand' and store.fulfillment_rate < 80:
        avail_score *= Decimal('0.7')

    # 3. Time Score (20%): Context-Aware
    time_score = Decimal('70.0')
    if response.delivery_option == 'online':
        avg_delivery = store.avg_delivery_time_mins or 60
        if avg_delivery <= 30: time_score = Decimal('100.0')
        elif avg_delivery >= 120: time_score = Decimal('10.0')
        else: time_score = Decimal('100.0') - Decimal(str(avg_delivery - 30)) * Decimal('1.0')
    else:
        avg_response = store.avg_response_time_mins or 30
        time_score = Decimal(str(max(0, 100 - (avg_response * 2))))

    # 4. Rating Score (20%)
    effective_rating = float(store.average_rating) if store.total_ratings >= 5 else 3.0
    rating_score = Decimal(str((effective_rating / 5.0) * 100.0))

    # 5. Marketplace Dynamics v4 ⚖️
    
    # 🚀 Gated Exploration Boost: ONLY for reliable stores
    exploration_boost = Decimal('0.0')
    if (store.exposure_count or 0) < 50 and store.fulfillment_rate >= 80:
        exploration_boost = Decimal('10.0')
    
    # 📉 Thresholded Win Rate (Small sample size filter)
    win_boost = Decimal('0.0')
    if store.quotes_sent_count >= 10:
        win_rate = Decimal(str(store.get_win_rate()))
        win_boost = min(Decimal('10.0'), (win_rate / Decimal('100.0')) * Decimal('10.0')) 
    
    # 🏆 Volume/Premium Seller Boost
    volume_boost = Decimal('0.0')
    if (store.total_completed_value or 0) > 100000 and store.fulfillment_rate > 92:
        volume_boost = Decimal('5.0')

    # 📉 Penalties: Use Decimal for multipliers
    selective_penalty = Decimal('1.0')
    if store.quotes_sent_count > 20 and store.get_win_rate() < 15:
        selective_penalty = Decimal('0.8')

    fulfillment_penalty = Decimal('1.0')
    if store.fulfillment_rate < 70: fulfillment_penalty = Decimal('0.5')
    elif store.fulfillment_rate < 85: fulfillment_penalty = Decimal('0.8')

    # Final Calculation (Pure Decimal)
    total_score = (
        (price_score * W_PRICE) + 
        (avail_score * W_AVAIL) + 
        (time_score * W_TIME) + 
        (rating_score * W_RATING)
    ) * fulfillment_penalty * selective_penalty + win_boost + exploration_boost + volume_boost

    return round(total_score, 2)

def get_smart_tags(response, all_responses):
    tags = []
    if response.delivery_option == 'online':
        times = [r.store.avg_delivery_time_mins for r in all_responses if r.delivery_option == 'online' and r.store.avg_delivery_time_mins]
        if times:
            best_time = min(times)
            if response.store.avg_delivery_time_mins <= best_time + 10:
                tags.append("Fast Delivery")
    if response.store.average_rating > 4.5 and response.store.total_ratings >= 5:
        tags.append("Top Rated Store")
    return tags

def get_store_badges(store):
    badges = []
    if store.repeat_order_count > 10 and store.get_win_rate() > 35:
        badges.append("Top Seller")
    if store.fulfillment_rate > 90 and store.completed_orders_count > 5:
        badges.append("Reliable")
    if (store.avg_delivery_time_mins or 120) < 45 and store.completed_orders_count > 5:
        badges.append("Fastest")
    return badges
