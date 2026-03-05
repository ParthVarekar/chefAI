// ============================================================
// ChefAI Mock Restaurant Data
// ============================================================

export interface MenuItem {
    name: string;
    price: number;
    category: string;
}

export interface ComboMeal {
    name: string;
    items: string[];
    price: number;
    popular?: boolean;
}

export interface Special {
    name: string;
    price: number;
    tag: string;
}

export interface ReservationSlot {
    time: string;
    tableSize: number;
    available: boolean;
}

// --- Menu ---
export const menuItems: MenuItem[] = [
    { name: 'Truffle Burger', price: 14, category: 'Mains' },
    { name: 'Classic Burger', price: 11, category: 'Mains' },
    { name: 'Margherita Pizza', price: 12, category: 'Mains' },
    { name: 'Pepperoni Pizza', price: 13, category: 'Mains' },
    { name: 'Chicken Wrap', price: 9, category: 'Mains' },
    { name: 'Caesar Salad', price: 8, category: 'Starters' },
    { name: 'Fries', price: 4, category: 'Sides' },
    { name: 'Coke', price: 3, category: 'Beverages' },
    { name: 'Iced Tea', price: 3, category: 'Beverages' },
];

// --- Combos ---
export const comboMeals: ComboMeal[] = [
    {
        name: 'Burger Combo',
        items: ['Burger', 'Fries', 'Coke'],
        price: 12,
        popular: true,
    },
    {
        name: 'Pizza Combo',
        items: ['Pizza', 'Drink'],
        price: 11,
    },
    {
        name: 'Wrap Combo',
        items: ['Chicken Wrap', 'Fries', 'Drink'],
        price: 10,
    },
];

// --- Today's Specials ---
export const todaySpecials: Special[] = [
    { name: 'Truffle Burger', price: 12, tag: 'discounted' },
    { name: 'Pepperoni Pizza', price: 10, tag: 'limited special' },
    { name: 'Burger Combo', price: 10, tag: 'combo deal' },
];

// --- Reservations ---
export const reservationSlots: ReservationSlot[] = [
    { time: '7:00 PM', tableSize: 2, available: true },
    { time: '7:30 PM', tableSize: 4, available: true },
    { time: '8:00 PM', tableSize: 6, available: true },
];

// --- Kitchen Status Messages ---
export const kitchenStatuses: string[] = [
    'Kitchen is running smoothly.',
    'Truffle Burger is trending today.',
    'Fries inventory running slightly low.',
    'Kitchen is currently handling peak dinner rush.',
];
