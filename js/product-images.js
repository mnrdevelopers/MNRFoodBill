const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/mnrdevelopers/MNRFoodBill/main/productimages/';

// Product name to image filename mapping
const PRODUCT_IMAGES = {
    // Burgers
    'Classic Burger': 'classic-burger.jpg',
    'Cheese Burger': 'cheese-burger.jpg',
    'Chicken Burger': 'chicken-burger.jpg',
    'Veg Burger': 'veg-burger.jpg',
    'Double Burger': 'double-burger.jpg',
    
    // Pizzas
    'Margherita Pizza': 'margherita-pizza.jpg',
    'Pepperoni Pizza': 'pepperoni-pizza.jpg',
    'Veg Supreme Pizza': 'veg-supreme-pizza.jpg',
    'BBQ Chicken Pizza': 'bbq-chicken-pizza.jpg',
    'Paneer Pizza': 'paneer-pizza.jpg',
    
    // Snacks
    'French Fries': 'french-fries.jpg',
    'Nachos': 'nachos.jpg',
    'Chicken Wings': 'chicken-wings.jpg',
    'Spring Rolls': 'spring-rolls.jpg',
    'Garlic Bread': 'garlic-bread.jpg',
    
    // Beverages
    'Coca Cola': 'coca-cola.jpg',
    'Orange Juice': 'orange-juice.jpg',
    'Mango Shake': 'mango-shake.jpg',
    'Coffee': 'coffee.jpg',
    'Mineral Water': 'water.jpg',
    
    // Desserts
    'Chocolate Ice Cream': 'chocolate-icecream.jpg',
    'Chocolate Cake': 'chocolate-cake.jpg',
    'Brownie': 'brownie.jpg',
    'Cheesecake': 'cheesecake.jpg',
    'Fruit Salad': 'fruit-salad.jpg',
    
    // Combos
    'Burger Combo': 'burger-combo.jpg',
    'Pizza Combo': 'pizza-combo.jpg',
    'Snack Combo': 'snack-combo.jpg',
    'Family Combo': 'family-combo.jpg',
    'Value Combo': 'value-combo.jpg'
};

// Function to get image URL for a product
function getProductImage(productName) {
    const fileName = PRODUCT_IMAGES[productName];
    if (fileName) {
        return GITHUB_BASE_URL + fileName;
    }
    return null; // Return null if no image found
}

// Function to get all available image URLs
function getAllProductImages() {
    const images = [];
    for (const [productName, fileName] of Object.entries(PRODUCT_IMAGES)) {
        images.push({
            name: productName,
            url: GITHUB_BASE_URL + fileName
        });
    }
    return images;
}

// Function to get images by category (approximate based on name)
function getImagesByCategory(category) {
    const categoryImages = [];
    
    // Simple category detection based on product name
    for (const [productName, fileName] of Object.entries(PRODUCT_IMAGES)) {
        if (category === 'Burgers' && productName.includes('Burger')) {
            categoryImages.push({
                name: productName,
                url: GITHUB_BASE_URL + fileName
            });
        }
        else if (category === 'Pizzas' && productName.includes('Pizza')) {
            categoryImages.push({
                name: productName,
                url: GITHUB_BASE_URL + fileName
            });
        }
        else if (category === 'Snacks' && (productName.includes('Fries') || 
                  productName.includes('Nachos') || 
                  productName.includes('Wings') ||
                  productName.includes('Rolls') ||
                  productName.includes('Bread'))) {
            categoryImages.push({
                name: productName,
                url: GITHUB_BASE_URL + fileName
            });
        }
        else if (category === 'Beverages' && (productName.includes('Cola') || 
                  productName.includes('Juice') || 
                  productName.includes('Shake') ||
                  productName.includes('Coffee') ||
                  productName.includes('Water'))) {
            categoryImages.push({
                name: productName,
                url: GITHUB_BASE_URL + fileName
            });
        }
        else if (category === 'Desserts' && (productName.includes('Ice Cream') || 
                  productName.includes('Cake') || 
                  productName.includes('Brownie') ||
                  productName.includes('Cheesecake') ||
                  productName.includes('Fruit Salad'))) {
            categoryImages.push({
                name: productName,
                url: GITHUB_BASE_URL + fileName
            });
        }
        else if (category === 'Combos' && productName.includes('Combo')) {
            categoryImages.push({
                name: productName,
                url: GITHUB_BASE_URL + fileName
            });
        }
    }
    
    return categoryImages;
}
