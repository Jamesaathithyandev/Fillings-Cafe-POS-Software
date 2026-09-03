// Sree Sai Fillings Cafe - Initial Menu Dataset
// Extracted from official cafe menu cards

module.exports = {
  cafeInfo: {
    name: 'Sree Sai Fillings Cafe',
    tagline: 'Live & Xclusive Eat Club • Crispy • Cheesy • Delicious',
    address: 'No, 61/1, 61/2, Sesi Avenue West, Church Road, Cheran Ma Nagar, Coimbatore - 641 035',
    phone: '82200 88119',
    fssai: 'Applied / In Registration',
    currency: '₹'
  },
  categories: [
    { name: 'FRIED ITEMS', icon: '🍟', display_order: 1 },
    { name: 'WRAP', icon: '🌯', display_order: 2 },
    { name: 'PASTA', icon: '🍝', display_order: 3 },
    { name: 'MAGGIE', icon: '🍜', display_order: 4 },
    { name: 'BREAD OMELETTE', icon: '🍳', display_order: 5 },
    { name: 'FRIED CRISPY CHICKEN', icon: '🍗', display_order: 6 },
    { name: 'BURGER', icon: '🍔', display_order: 7 },
    { name: 'SANDWICH', icon: '🥪', display_order: 8 },
    { name: 'BBQ', icon: '🍖', display_order: 9 },
    { name: 'SOFT DRINK & SHAKES', icon: '🥤', display_order: 10 },
    { name: 'FRESH JUICE', icon: '🍹', display_order: 11 },
    { name: 'DESSERT', icon: '🍨', display_order: 12 }
  ],
  items: [
    // FRIED ITEMS
    { code: 'ITEM-001', category: 'FRIED ITEMS', name: 'Chicken Nuggets', price: 89.00, desc: 'Crispy fried chicken nuggets served with dips' },
    { code: 'ITEM-002', category: 'FRIED ITEMS', name: 'Chicken Fingers', price: 89.00, desc: 'Golden crunchy chicken fingers' },
    { code: 'ITEM-003', category: 'FRIED ITEMS', name: 'French Fries Regular', price: 69.00, desc: 'Classic salted golden fries' },
    { code: 'ITEM-004', category: 'FRIED ITEMS', name: 'French Fries Large', price: 99.00, desc: 'Large portion of classic salted golden fries' },
    { code: 'ITEM-005', category: 'FRIED ITEMS', name: 'Peri Peri Fries Regular', price: 79.00, desc: 'Fries tossed in spicy Peri Peri seasoning' },
    { code: 'ITEM-006', category: 'FRIED ITEMS', name: 'Peri Peri Fries Large', price: 109.00, desc: 'Large portion of spicy Peri Peri fries' },
    { code: 'ITEM-007', category: 'FRIED ITEMS', name: 'Veg Nuggets', price: 79.00, desc: 'Crispy seasoned vegetable nuggets' },
    { code: 'ITEM-008', category: 'FRIED ITEMS', name: 'Smiley Potato', price: 79.00, desc: 'Golden crispy potato smileys' },

    // WRAP
    { code: 'ITEM-009', category: 'WRAP', name: 'Mushroom Wrap', price: 79.00, desc: 'Sauteed mushrooms with fresh veggies and sauces in tortilla' },
    { code: 'ITEM-010', category: 'WRAP', name: 'Paneer Wrap', price: 89.00, desc: 'Spiced paneer cubes rolled with crisp greens' },
    { code: 'ITEM-011', category: 'WRAP', name: 'Crispy Chicken Wrap', price: 99.00, desc: 'Crunchy chicken strips rolled with creamy house dressing' },
    { code: 'ITEM-012', category: 'WRAP', name: 'Chicken Tikka Wrap', price: 99.00, desc: 'Smoky spiced chicken tikka with onions and mint sauce' },
    { code: 'ITEM-013', category: 'WRAP', name: 'Peri Peri Chicken Wrap', price: 119.00, desc: 'Fiery peri peri seasoned chicken wrap' },
    { code: 'ITEM-014', category: 'WRAP', name: 'Add Extra Cheese', price: 20.00, desc: 'Extra layer of melted cheese' },

    // PASTA
    { code: 'ITEM-015', category: 'PASTA', name: 'Veg Cheese Pasta', price: 69.00, desc: 'Penne pasta tossed in rich cheese & vegetable sauce' },
    { code: 'ITEM-016', category: 'PASTA', name: 'Mushroom Cheese Pasta', price: 79.00, desc: 'Penne with tender mushrooms and melted cheese' },
    { code: 'ITEM-017', category: 'PASTA', name: 'Paneer Cheese Pasta', price: 79.00, desc: 'Penne pasta loaded with paneer and savory cheese' },
    { code: 'ITEM-018', category: 'PASTA', name: 'Chicken Cheese Pasta', price: 99.00, desc: 'Pasta with tender chicken chunks and cheese sauce' },
    { code: 'ITEM-019', category: 'PASTA', name: 'Peri Peri Chicken Pasta', price: 119.00, desc: 'Spicy peri peri sauce with chicken and cheese' },

    // MAGGIE
    { code: 'ITEM-020', category: 'MAGGIE', name: 'Veg Maggie', price: 59.00, desc: 'Classic noodles cooked with vegetables and spices' },
    { code: 'ITEM-021', category: 'MAGGIE', name: 'Mushroom Maggie', price: 89.00, desc: 'Noodles sauteed with fresh mushroom masala' },
    { code: 'ITEM-022', category: 'MAGGIE', name: 'Paneer Maggie', price: 89.00, desc: 'Maggie tossed with succulent paneer cubes' },
    { code: 'ITEM-023', category: 'MAGGIE', name: 'Egg Maggie', price: 69.00, desc: 'Spicy noodles with scrambled egg' },
    { code: 'ITEM-024', category: 'MAGGIE', name: 'Chicken Maggie', price: 99.00, desc: 'Maggie cooked with seasoned chicken chunks' },
    { code: 'ITEM-025', category: 'MAGGIE', name: 'Peri Peri Chicken Maggie', price: 119.00, desc: 'Extra fiery peri peri chicken noodles' },

    // BREAD OMELETTE
    { code: 'ITEM-026', category: 'BREAD OMELETTE', name: 'Bread Omelette', price: 40.00, desc: 'Classic spiced double egg bread toast' },
    { code: 'ITEM-027', category: 'BREAD OMELETTE', name: 'Chicken Bread Omelette', price: 50.00, desc: 'Bread omelette stuffed with shredded chicken' },
    { code: 'ITEM-028', category: 'BREAD OMELETTE', name: 'Chicken Cheese Bread Omelette', price: 60.00, desc: 'Omelette stuffed with chicken and melted cheese' },
    { code: 'ITEM-029', category: 'BREAD OMELETTE', name: 'Peri Peri Chicken Bread Omelette', price: 70.00, desc: 'Spicy peri peri chicken stuffed bread omelette' },

    // FRIED CRISPY CHICKEN
    { code: 'ITEM-030', category: 'FRIED CRISPY CHICKEN', name: 'Chicken Crispy (1pcs)', price: 59.00, desc: 'Single piece of signature crispy fried chicken' },
    { code: 'ITEM-031', category: 'FRIED CRISPY CHICKEN', name: 'Chicken Popcorn', price: 79.00, desc: 'Bite-sized crunchy chicken poppers' },
    { code: 'ITEM-032', category: 'FRIED CRISPY CHICKEN', name: 'Chicken Fried Wings (5pcs)', price: 99.00, desc: '5 pieces of deep-fried crispy wings' },
    { code: 'ITEM-033', category: 'FRIED CRISPY CHICKEN', name: 'Chicken Strips (6pcs)', price: 149.00, desc: '6 pieces of golden boneless chicken tenders' },
    { code: 'ITEM-034', category: 'FRIED CRISPY CHICKEN', name: 'Chicken Lollipop (4pcs)', price: 199.00, desc: '4 pieces of flavorful chicken lollipops' },
    { code: 'ITEM-035', category: 'FRIED CRISPY CHICKEN', name: 'Peri Peri Chicken Wings (5pcs)', price: 149.00, desc: '5 crispy wings seasoned with spicy peri peri' },
    { code: 'ITEM-036', category: 'FRIED CRISPY CHICKEN', name: 'Hot & Spicy Crispy Wings (5pcs)', price: 149.00, desc: '5 wings with hot and fiery pepper seasoning' },
    { code: 'ITEM-037', category: 'FRIED CRISPY CHICKEN', name: 'Jumbo Popcorn Chicken', price: 199.00, desc: 'Extra large bucket of chicken popcorn' },
    { code: 'ITEM-038', category: 'FRIED CRISPY CHICKEN', name: 'Bucket Chicken (1leg, 2 wings, Strips)', price: 199.00, desc: 'Variety combo of crispy chicken items' },
    { code: 'ITEM-039', category: 'FRIED CRISPY CHICKEN', name: 'Chicken Crispy (3pcs)', price: 179.00, desc: '3 pieces of golden crispy chicken' },
    { code: 'ITEM-040', category: 'FRIED CRISPY CHICKEN', name: 'Chicken Crispy (5pcs)', price: 299.00, desc: '5 pieces of golden crispy chicken' },
    { code: 'ITEM-041', category: 'FRIED CRISPY CHICKEN', name: 'Hot & Spicy Chicken Crispy (3pcs)', price: 199.00, desc: '3 pieces hot & spicy crispy chicken' },
    { code: 'ITEM-042', category: 'FRIED CRISPY CHICKEN', name: 'Peri Peri Chicken Crispy (3pcs)', price: 199.00, desc: '3 pieces peri peri spiced crispy chicken' },
    { code: 'ITEM-043', category: 'FRIED CRISPY CHICKEN', name: 'Hot & Spicy Chicken Crispy (5pcs)', price: 319.00, desc: '5 pieces hot & spicy crispy chicken' },
    { code: 'ITEM-044', category: 'FRIED CRISPY CHICKEN', name: 'Peri Peri Chicken Crispy (5pcs)', price: 319.00, desc: '5 pieces peri peri spiced crispy chicken' },

    // BURGER
    { code: 'ITEM-045', category: 'BURGER', name: 'Veg Burger', price: 99.00, desc: 'Veggie patty with fresh lettuce, mayo, and toasted buns' },
    { code: 'ITEM-046', category: 'BURGER', name: 'Veg Double Decker Burger', price: 149.00, desc: 'Double veg patties layered with double cheese' },
    { code: 'ITEM-047', category: 'BURGER', name: 'Paneer Burger', price: 149.00, desc: 'Crispy spiced paneer patty with creamy dressing' },
    { code: 'ITEM-048', category: 'BURGER', name: 'Double Cheese Burger (Veg)', price: 169.00, desc: 'Loaded with extra cheddar and cheese slice' },
    { code: 'ITEM-049', category: 'BURGER', name: 'Veg Jumbo Spicy Burger', price: 189.00, desc: 'Jumbo size spicy veggie burger' },
    { code: 'ITEM-050', category: 'BURGER', name: 'Chicken Burger', price: 129.00, desc: 'Classic seasoned chicken patty burger' },
    { code: 'ITEM-051', category: 'BURGER', name: 'Crispy Chicken Burger', price: 149.00, desc: 'Fried crunchy whole chicken fillet burger' },
    { code: 'ITEM-052', category: 'BURGER', name: 'Grilled Chicken Burger', price: 149.00, desc: 'Smoky grilled tender chicken fillet' },
    { code: 'ITEM-053', category: 'BURGER', name: 'Double Cheese Chicken Burger', price: 169.00, desc: 'Chicken patty with double cheese layer' },
    { code: 'ITEM-054', category: 'BURGER', name: 'Crispy Chicken Jumbo Burger', price: 199.00, desc: 'Giant crispy chicken burger for big appetites' },

    // SANDWICH
    { code: 'ITEM-055', category: 'SANDWICH', name: 'Cheese Sandwich', price: 49.00, desc: 'Grilled bread stuffed with molten cheese' },
    { code: 'ITEM-056', category: 'SANDWICH', name: 'Mushroom Cheese Sandwich', price: 69.00, desc: 'Sauteed mushrooms with cheese blend' },
    { code: 'ITEM-057', category: 'SANDWICH', name: 'Paneer Cheese Sandwich', price: 69.00, desc: 'Spiced paneer filling with gooey cheese' },
    { code: 'ITEM-058', category: 'SANDWICH', name: 'Chicken Cheese Sandwich', price: 99.00, desc: 'Shredded chicken and cheese grilled to perfection' },
    { code: 'ITEM-059', category: 'SANDWICH', name: 'Crispy Chicken Cheese Sandwich', price: 119.00, desc: 'Crunchy chicken fillet with cheese' },
    { code: 'ITEM-060', category: 'SANDWICH', name: 'Add Extra Cheese (Sandwich)', price: 20.00, desc: 'Extra cheese slice' },

    // BBQ
    { code: 'ITEM-061', category: 'BBQ', name: 'BBQ Wings (4pcs)', price: 79.00, desc: '4 pieces juicy wings glazed in smoky BBQ sauce' },
    { code: 'ITEM-062', category: 'BBQ', name: 'BBQ Quarter (2pcs)', price: 99.00, desc: '2 pieces grilled quarter chicken with BBQ sauce' },
    { code: 'ITEM-063', category: 'BBQ', name: 'BBQ Half (4pcs)', price: 189.00, desc: '4 pieces grilled half chicken in BBQ sauce' },
    { code: 'ITEM-064', category: 'BBQ', name: 'BBQ Full (8pcs)', price: 369.00, desc: '8 pieces whole grilled chicken with BBQ glaze' },
    { code: 'ITEM-065', category: 'BBQ', name: 'Peri BBQ Half (4pcs)', price: 239.00, desc: '4 pieces spicy peri peri infused BBQ chicken' },
    { code: 'ITEM-066', category: 'BBQ', name: 'Peri Peri BBQ Full (8pcs)', price: 399.00, desc: '8 pieces spicy peri peri BBQ whole chicken' },

    // SOFT DRINK & SHAKES
    { code: 'ITEM-067', category: 'SOFT DRINK & SHAKES', name: 'Rose Milk', price: 49.00, desc: 'Refreshing chilled rose infused milk' },
    { code: 'ITEM-068', category: 'SOFT DRINK & SHAKES', name: 'Classic Mojito', price: 59.00, desc: 'Crisp mint and lime sparkling cooler' },
    { code: 'ITEM-069', category: 'SOFT DRINK & SHAKES', name: 'Watermelon Mojito', price: 59.00, desc: 'Sweet watermelon with fresh mint & soda' },
    { code: 'ITEM-070', category: 'SOFT DRINK & SHAKES', name: 'Blue Mojito', price: 59.00, desc: 'Blue curacao flavored fizzy cooler' },
    { code: 'ITEM-071', category: 'SOFT DRINK & SHAKES', name: 'Green Apple Mojito', price: 59.00, desc: 'Tangy green apple and mint refresher' },
    { code: 'ITEM-072', category: 'SOFT DRINK & SHAKES', name: 'Hot Chocolate', price: 60.00, desc: 'Rich warm cocoa drink' },
    { code: 'ITEM-073', category: 'SOFT DRINK & SHAKES', name: 'Strawberry Milk Shake', price: 99.00, desc: 'Creamy strawberry thickshake' },
    { code: 'ITEM-074', category: 'SOFT DRINK & SHAKES', name: 'Chocolate Milk Shake', price: 99.00, desc: 'Classic thick chocolate milkshake' },
    { code: 'ITEM-075', category: 'SOFT DRINK & SHAKES', name: 'Vanilla Milk Shake', price: 99.00, desc: 'Smooth vanilla bean milkshake' },
    { code: 'ITEM-076', category: 'SOFT DRINK & SHAKES', name: 'Mango Milk Shake', price: 119.00, desc: 'Rich Alphonso mango milkshake' },
    { code: 'ITEM-077', category: 'SOFT DRINK & SHAKES', name: 'Oreo Milk Shake', price: 119.00, desc: 'Cookies & cream blended thickshake' },
    { code: 'ITEM-078', category: 'SOFT DRINK & SHAKES', name: 'Kit Kat Milk Shake', price: 119.00, desc: 'Crunchy chocolate KitKat blended shake' },

    // FRESH JUICE
    { code: 'ITEM-079', category: 'FRESH JUICE', name: 'Lime Juice', price: 29.00, desc: 'Freshly squeezed sweet and salted lime' },
    { code: 'ITEM-080', category: 'FRESH JUICE', name: 'Mint Lime Juice', price: 39.00, desc: 'Lime juice infused with fresh mint leaves' },
    { code: 'ITEM-081', category: 'FRESH JUICE', name: 'Gooseberry Juice', price: 49.00, desc: 'Healthy fresh amla juice' },
    { code: 'ITEM-082', category: 'FRESH JUICE', name: 'Beetroot Juice', price: 49.00, desc: 'Fresh cold pressed beetroot juice' },
    { code: 'ITEM-083', category: 'FRESH JUICE', name: 'Carrot Juice', price: 49.00, desc: 'Freshly extracted sweet carrot juice' },
    { code: 'ITEM-084', category: 'FRESH JUICE', name: 'Apple Juice', price: 79.00, desc: 'Fresh pure apple juice' },
    { code: 'ITEM-085', category: 'FRESH JUICE', name: 'Pomegranate Juice', price: 79.00, desc: 'Rich fresh pomegranate juice' },

    // DESSERT
    { code: 'ITEM-086', category: 'DESSERT', name: 'Vanilla Ice Cream (2 Scoops)', price: 50.00, desc: 'Two scoops of vanilla ice cream' },
    { code: 'ITEM-087', category: 'DESSERT', name: 'Chocolate Ice Cream (2 Scoops)', price: 80.00, desc: 'Two scoops of rich chocolate ice cream' },
    { code: 'ITEM-088', category: 'DESSERT', name: 'Fudge Brownie', price: 59.00, desc: 'Warm gooey chocolate brownie' },
    { code: 'ITEM-089', category: 'DESSERT', name: 'Brownie with Ice Cream', price: 109.00, desc: 'Warm brownie served with a scoop of vanilla ice cream' },
    { code: 'ITEM-090', category: 'DESSERT', name: 'Sizzling Brownie', price: 129.00, desc: 'Sizzling plate brownie with ice cream and hot chocolate fudge' }
  ]
};
