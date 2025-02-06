// Constants
const WEATHER_API_KEY = '33cad144936c3ba088dafcc3c3002771'; // Replace with actual API key
const GEMINI_API_KEY = 'AIzaSyCX0KeV2M_q784a9SbfhJJV1k1YjPDVApE';
let currentCity = 'London'; // Default city

// Color mapping for CSS colors
const COLOR_MAPPING = {
    'Navy Blue': '#000080',
    'Forest Green': '#228B22',
    'Burgundy': '#800020',
    'Charcoal Gray': '#364135',
    'Royal Purple': '#7851A9',
    'Emerald Green': '#50C878',
    'Deep Red': '#DC143C',
    'Teal': '#008080',
    'Plum': '#8B4513',
    'Olive Green': '#808000',
    'Sky Blue': '#87CEEB',
    'Coral': '#FF7F50',
    'Lavender': '#E6E6FA',
    'Mint Green': '#98FF98',
    'Rose Pink': '#FF66B2',
    'Golden Yellow': '#FFD700',
    'Turquoise': '#40E0D0',
    'Peach': '#FFE5B4',
    'Indigo': '#4B0082',
    'Sage Green': '#9DC183'
};

const DEFAULT_COLORS = Object.keys(COLOR_MAPPING);

// Utility Functions
const getTodayString = () => new Date().toISOString().split('T')[0];

const getRandomColor = (colors) => {
    // Ensure we have a valid array of colors
    if (!Array.isArray(colors) || colors.length === 0) {
        colors = DEFAULT_COLORS;
    }
    // Generate a more random index using current timestamp
    const randomIndex = Math.floor(Math.random() * colors.length * Date.now()) % colors.length;
    return colors[randomIndex];
};

// Local Storage Functions
const getFavoriteColors = () => {
    const stored = localStorage.getItem('favoriteColors');
    return stored ? JSON.parse(stored) : DEFAULT_COLORS;
};

const saveFavoriteColors = (colors) => {
    localStorage.setItem('favoriteColors', JSON.stringify(colors));
};

const deleteFavoriteColors = () => {
    localStorage.removeItem('favoriteColors');
    localStorage.removeItem('dailySuggestion'); // Reset daily suggestion too
    updateCurrentFavorites();
    generateDailySuggestion(); // Generate new suggestion based on default colors
};

const getDailySuggestion = () => {
    const stored = localStorage.getItem('dailySuggestion');
    return stored ? JSON.parse(stored) : null;
};

const saveDailySuggestion = (color) => {
    const suggestion = {
        date: getTodayString(),
        color: color
    };
    localStorage.setItem('dailySuggestion', JSON.stringify(suggestion));
};

// Weather Integration
const fetchWeather = async () => {
    try {
        // Ensure we're using HTTPS and the API key is properly formatted
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${currentCity}&appid=${WEATHER_API_KEY.trim()}&units=metric`;
        console.log('Attempting to fetch weather data...');
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Weather API Error:', errorData);
            throw new Error(`Weather API error: ${errorData.message}`);
        }
        
        const data = await response.json();
        console.log('Weather data received successfully:', data);
        return data;
    } catch (error) {
        console.error('Weather API Error:', error.message);
        document.getElementById('weather-info').innerHTML = 
            `<p>⚠️ Error fetching weather: ${error.message}</p>`;
        return null;
    }
};

// Weather-based color suggestions
const getWeatherBasedColors = (weather) => {
    const temp = weather.main.temp;
    const condition = weather.weather[0].main.toLowerCase();
    
    // Warm colors for sunny/hot weather
    if (temp > 25 || condition.includes('clear') || condition.includes('sun')) {
        return ['red', 'orange', 'yellow', 'coral', 'pink'];
    }
    
    // Cool colors for cold/cloudy weather
    if (temp < 15 || condition.includes('cloud') || condition.includes('rain')) {
        return ['blue', 'navy', 'teal', 'purple', 'gray'];
    }
    
    // Neutral/fresh colors for mild weather
    return ['green', 'turquoise', 'mint', 'lavender', 'beige'];
};

// AI Color Suggestion with Explanation
async function getAIColorSuggestion(weather, preferences) {
    const explanationDiv = document.getElementById('color-explanation');
    explanationDiv.innerHTML = `
        <div class="ai-thinking">
            <span>AI is thinking</span>
            <div class="dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        </div>
    `;
    explanationDiv.classList.add('show');

    try {
        // Create normalized color list for the prompt
        const normalizedColors = DEFAULT_COLORS.map(color => color.toLowerCase().replace(/\s+/g, ' ').trim());
        
        const prompt = `You are a fashion expert. Based on the following information, suggest ONE color from this specific list: ${DEFAULT_COLORS.join(', ')}

Current conditions:
- Weather: ${weather.main.temp}°C, ${weather.weather[0].description}
- User's favorite colors: ${preferences.join(', ')}
- Time: ${new Date().getHours()}:00

Please format your response exactly like this example:
COLOR: Navy Blue
REASON: Perfect for a cloudy day, this calming shade complements the weather while staying stylish.

Remember to ONLY suggest colors from the provided list EXACTLY as written above. Do not modify the color names.`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    safetySettings: [{
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_NONE"
                    }]
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('AI API Error:', errorData);
            throw new Error('AI API request failed');
        }

        const data = await response.json();
        console.log('AI Response:', data);
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
            throw new Error('Invalid API response structure');
        }

        const aiResponse = data.candidates[0].content.parts[0].text.trim();
        console.log('AI Text Response:', aiResponse);
        
        // Parse AI response with more flexible regex
        const colorMatch = aiResponse.match(/COLOR:?\s*([^]*?)(?=\n|REASON:|$)/i);
        const reasonMatch = aiResponse.match(/REASON:?\s*([^]*?)(?=COLOR:|$)/i);
        
        if (!colorMatch) {
            throw new Error('No color found in response');
        }

        const suggestedColor = colorMatch[1].trim();
        const explanation = reasonMatch ? reasonMatch[1].trim() : 'This color suits the current weather and your preferences.';

        // Find the exact color match (case-insensitive)
        const exactColor = DEFAULT_COLORS.find(
            color => color.toLowerCase() === suggestedColor.toLowerCase()
        );

        if (!exactColor) {
            console.error('Invalid color suggested:', suggestedColor);
            console.error('Valid colors:', DEFAULT_COLORS);
            throw new Error('Invalid color suggestion');
        }

        // Update explanation
        explanationDiv.innerHTML = `
            <i class="fas fa-lightbulb"></i>
            <span>${explanation}</span>
        `;

        return exactColor;
    } catch (error) {
        console.error('AI suggestion failed:', error);
        
        // Get weather-based colors
        const weatherBasedColors = getWeatherBasedColors(weather);
        
        // Filter by user preferences if available
        const availableColors = preferences.length > 0 
            ? preferences.filter(color => weatherBasedColors.includes(color))
            : weatherBasedColors;
        
        const selectedColor = getRandomColor(availableColors.length > 0 ? availableColors : DEFAULT_COLORS);
        
        // Update explanation for fallback
        explanationDiv.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <span>Selected ${selectedColor} based on the current weather (${weather.weather[0].description}) 
            and temperature (${Math.round(weather.main.temp)}°C).</span>
        `;
        
        return selectedColor;
    }
}

// UI Update Functions
const updateColorDisplay = (color) => {
    const colorDisplay = document.getElementById('color-display');
    const colorName = document.getElementById('color-name');
    const body = document.body;
    
    // Get the hex color from our mapping
    const hexColor = COLOR_MAPPING[color] || color;
    
    // Update color display
    colorDisplay.style.backgroundColor = hexColor;
    colorName.textContent = color;
    
    // Create a lighter version of the color for the background gradient
    const rgb = hexToRgb(hexColor);
    const lighterColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`;
    
    // Update background gradient
    document.documentElement.style.setProperty('--background-gradient', lighterColor);
    
    // Add contrasting text color for better visibility
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    colorName.style.color = brightness > 128 ? '#000000' : '#FFFFFF';
    
    // Add text shadow based on brightness
    if (brightness > 128) {
        colorName.style.textShadow = '1px 1px 2px rgba(0,0,0,0.4)';
    } else {
        colorName.style.textShadow = '1px 1px 2px rgba(255,255,255,0.4)';
    }
    
    // Add animation class
    colorDisplay.classList.remove('color-change');
    void colorDisplay.offsetWidth; // Trigger reflow
    colorDisplay.classList.add('color-change');
};

const getComplementaryColor = (hexcolor) => {
    const rgb = hexToRgb(hexcolor);
    const complement = {
        r: 255 - rgb.r,
        g: 255 - rgb.g,
        b: 255 - rgb.b
    };
    return `rgb(${complement.r}, ${complement.g}, ${complement.b})`;
};

const updateCurrentFavorites = () => {
    const favorites = getFavoriteColors();
    const favoritesDiv = document.getElementById('current-favorites');
    
    if (favorites.length === 0 || favorites === DEFAULT_COLORS) {
        favoritesDiv.innerHTML = `
            <p><i class="fas fa-info-circle"></i> No custom colors saved. Using default palette.</p>
        `;
    } else {
        favoritesDiv.innerHTML = `
            <p><i class="fas fa-palette"></i> Your colors:</p>
            <div class="color-chips">
                ${favorites.map(color => `
                    <span class="color-chip" style="background-color: ${COLOR_MAPPING[color]}">
                        ${color}
                    </span>
                `).join('')}
            </div>
        `;
    }
};

const updateWeatherInfo = (weather) => {
    const weatherInfo = document.getElementById('weather-info');
    if (!weather) {
        weatherInfo.innerHTML = `
            <p><i class="fas fa-exclamation-circle"></i></p>
            <p>Weather data unavailable</p>
        `;
        return;
    }

    const temp = Math.round(weather.main.temp);
    const description = weather.weather[0].description;
    const icon = weather.weather[0].icon;
    
    weatherInfo.innerHTML = `
        <img src="https://openweathermap.org/img/w/${icon}.png" alt="${description}">
        <div class="weather-details">
            <p class="temperature"><i class="fas fa-thermometer-half"></i> ${temp}°C</p>
            <p class="description">${description.charAt(0).toUpperCase() + description.slice(1)}</p>
        </div>
    `;
};

// Helper function to convert hex to RGB
const hexToRgb = (hex) => {
    // Remove the hash if present
    hex = hex.replace(/^#/, '');
    
    // Parse the hex values
    const bigint = parseInt(hex, 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
};

// Main Functions
const generateDailySuggestion = async () => {
    const today = getTodayString();
    const storedSuggestion = getDailySuggestion();

    if (storedSuggestion && storedSuggestion.date === today) {
        updateColorDisplay(storedSuggestion.color);
        return;
    }

    try {
        const weather = await fetchWeather();
        let availableColors = getFavoriteColors();
        
        // If we have weather data, use it to filter colors
        if (weather) {
            const weatherBasedColors = getWeatherBasedColors(weather);
            // Combine user preferences with weather-based suggestions
            availableColors = availableColors.length > 0 
                ? availableColors.filter(color => weatherBasedColors.includes(color))
                : weatherBasedColors;
        }

        // Ensure we have colors to choose from
        if (availableColors.length === 0) {
            availableColors = DEFAULT_COLORS;
        }

        const suggestedColor = getRandomColor(availableColors);
        saveDailySuggestion(suggestedColor);
        updateColorDisplay(suggestedColor);
    } catch (error) {
        console.error('Error generating suggestion:', error);
        // Fallback to simple random selection
        const suggestedColor = getRandomColor(DEFAULT_COLORS);
        saveDailySuggestion(suggestedColor);
        updateColorDisplay(suggestedColor);
    }
};

const getNewColorSuggestion = async () => {
    const colorDisplay = document.getElementById('color-display');
    const colorName = document.getElementById('color-name');
    const explanationDiv = document.getElementById('color-explanation');
    
    // Add loading state
    colorDisplay.style.opacity = '0.7';
    colorName.textContent = 'Thinking...';
    
    const weather = await fetchWeather();
    const preferences = getFavoriteColors();
    
    if (!weather) {
        const randomColor = getRandomColor(preferences);
        updateColorDisplay(randomColor);
        explanationDiv.classList.remove('show');
        return randomColor;
    }

    try {
        const aiSuggestion = await getAIColorSuggestion(weather, preferences);
        updateColorDisplay(aiSuggestion);
        return aiSuggestion;
    } catch (error) {
        console.error('Failed to get AI suggestion:', error);
        const randomColor = getRandomColor(preferences);
        updateColorDisplay(randomColor);
        explanationDiv.classList.remove('show');
        return randomColor;
    } finally {
        colorDisplay.style.opacity = '1';
    }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Page loaded, initializing app...');
    
    // Load saved city from localStorage
    const savedCity = localStorage.getItem('userCity');
    if (savedCity) {
        currentCity = savedCity;
        document.getElementById('location-input').value = savedCity;
    }

    // First update the UI with any stored preferences
    updateCurrentFavorites();
    
    // Then fetch fresh weather data and update suggestion
    try {
        console.log('Fetching initial weather data...');
        const weather = await fetchWeather();
        if (weather) {
            console.log('Weather data loaded successfully');
            updateWeatherInfo(weather);
            await generateDailySuggestion();
        }
    } catch (error) {
        console.error('Initial data load failed:', error);
        // Continue with color suggestion even if weather fails
        await generateDailySuggestion();
    }

    // Set up event listeners
    document.getElementById('get-suggestion').addEventListener('click', generateDailySuggestion);
    document.getElementById('get-new-color').addEventListener('click', getNewColorSuggestion);
    
    document.getElementById('delete-preferences').addEventListener('click', () => {
        if (confirm('Are you sure you want to delete your color preferences?')) {
            deleteFavoriteColors();
        }
    });

    document.getElementById('preferences-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('favorite-colors').value;
        const colors = input.split(',').map(c => c.trim()).filter(Boolean);
        
        if (colors.length > 0) {
            saveFavoriteColors(colors);
            updateCurrentFavorites();
            localStorage.removeItem('dailySuggestion');
            await generateDailySuggestion();
            document.getElementById('favorite-colors').value = '';
        }
    });
    
    // Location update event listeners
    document.getElementById('location-button').addEventListener('click', updateLocation);
    document.getElementById('location-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            updateLocation();
        }
    });
});

// Update location and weather
const updateLocation = async () => {
    const locationInput = document.getElementById('location-input');
    const newCity = locationInput.value.trim();
    
    if (!newCity) {
        showLocationError('Please enter a city name');
        return;
    }

    try {
        // Verify city exists by attempting to fetch weather
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${newCity}&appid=${WEATHER_API_KEY}&units=metric`
        );

        if (!response.ok) {
            throw new Error('City not found');
        }

        // Save the valid city
        currentCity = newCity;
        localStorage.setItem('userCity', newCity);
        
        // Update weather with new city
        updateWeather();
        
        // Clear any error messages
        clearLocationError();
        
        // Add success animation
        locationInput.classList.add('success-shake');
        setTimeout(() => locationInput.classList.remove('success-shake'), 500);
    } catch (error) {
        showLocationError('City not found. Please check the spelling and try again.');
    }
};

const showLocationError = (message) => {
    const locationForm = document.querySelector('.location-form');
    const existingError = locationForm.querySelector('.location-error');
    
    if (existingError) {
        existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'location-error';
    errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i>${message}`;
    locationForm.appendChild(errorDiv);
};

const clearLocationError = () => {
    const errorDiv = document.querySelector('.location-error');
    if (errorDiv) {
        errorDiv.remove();
    }
};

// Update weather information
const updateWeather = async () => {
    const weatherInfo = document.getElementById('weather-info');
    weatherInfo.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Loading weather data...</p>
    `;

    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${currentCity}&appid=${WEATHER_API_KEY}&units=metric`
        );
        
        if (!response.ok) {
            throw new Error('Weather data unavailable');
        }

        const weather = await response.json();
        const temp = Math.round(weather.main.temp);
        const description = weather.weather[0].description;
        const icon = weather.weather[0].icon;
        
        weatherInfo.innerHTML = `
            <div class="weather-location">
                <i class="fas fa-map-marker-alt"></i>
                <span>${weather.name}, ${weather.sys.country}</span>
            </div>
            <img src="https://openweathermap.org/img/w/${icon}.png" alt="${description}">
            <div class="weather-details">
                <p class="temperature"><i class="fas fa-thermometer-half"></i> ${temp}°C</p>
                <p class="description">${description.charAt(0).toUpperCase() + description.slice(1)}</p>
            </div>
        `;
    } catch (error) {
        weatherInfo.innerHTML = `
            <p class="weather-error">
                <i class="fas fa-exclamation-circle"></i>
                Weather data unavailable. Please try again later.
            </p>
        `;
    }
};
