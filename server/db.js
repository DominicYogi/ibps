// server/db.js — MongoDB Atlas backend
const { connectDB } = require('./db/connection');
const { Profile, Transaction, Budget, FoodPrice } = require('./models/index');

const DEFAULT_FOOD_PRICES = [
  { category:'breakfast', name:'Akara & Bread',          price:300,  unit:'plate',  emoji:'🥖' },
  { category:'breakfast', name:'Moi Moi (2 wraps)',       price:250,  unit:'plate',  emoji:'🟡' },
  { category:'breakfast', name:'Fried Egg & Bread',       price:400,  unit:'plate',  emoji:'🍳' },
  { category:'breakfast', name:'Pap & Akara',            price:300,  unit:'plate',  emoji:'🥣' },
  { category:'breakfast', name:'Tea & Bread',             price:250,  unit:'cup',    emoji:'☕' },
  { category:'breakfast', name:'Indomie (canteen)',       price:400,  unit:'plate',  emoji:'🍜' },
  { category:'lunch',     name:'Rice & Stew (small)',     price:400,  unit:'plate',  emoji:'🍚' },
  { category:'lunch',     name:'Rice & Stew (big)',       price:600,  unit:'plate',  emoji:'🍚' },
  { category:'lunch',     name:'Jollof Rice (small)',     price:500,  unit:'plate',  emoji:'🍛' },
  { category:'lunch',     name:'Jollof Rice (big)',       price:700,  unit:'plate',  emoji:'🍛' },
  { category:'lunch',     name:'Eba & Egusi Soup',        price:500,  unit:'plate',  emoji:'🫕' },
  { category:'lunch',     name:'Eba & Vegetable Soup',    price:500,  unit:'plate',  emoji:'🫕' },
  { category:'lunch',     name:'Pounded Yam & Soup',      price:700,  unit:'plate',  emoji:'🍲' },
  { category:'lunch',     name:'Beans & Plantain',        price:450,  unit:'plate',  emoji:'🫘' },
  { category:'lunch',     name:'Fried Rice & Chicken',    price:900,  unit:'plate',  emoji:'🍗' },
  { category:'lunch',     name:'Yam & Egg Sauce',         price:500,  unit:'plate',  emoji:'🍠' },
  { category:'dinner',    name:'Rice & Stew (small)',     price:400,  unit:'plate',  emoji:'🍚' },
  { category:'dinner',    name:'Eba & Soup',              price:500,  unit:'plate',  emoji:'🫕' },
  { category:'dinner',    name:'Spaghetti & Stew',        price:500,  unit:'plate',  emoji:'🍝' },
  { category:'dinner',    name:'Beans & Bread',           price:400,  unit:'plate',  emoji:'🫘' },
  { category:'dinner',    name:'Yam Porridge',            price:450,  unit:'plate',  emoji:'🍠' },
  { category:'snacks',    name:'Gala (sausage roll)',      price:200,  unit:'piece',  emoji:'🌭' },
  { category:'snacks',    name:'Chin Chin (small bag)',   price:100,  unit:'bag',    emoji:'🍪' },
  { category:'snacks',    name:'Roasted Groundnut',       price:100,  unit:'wrap',   emoji:'🥜' },
  { category:'snacks',    name:'Banana (x2)',             price:150,  unit:'piece',  emoji:'🍌' },
  { category:'snacks',    name:'Egg Roll',                price:150,  unit:'piece',  emoji:'🥚' },
  { category:'snacks',    name:'Fish Pie / Scotch Egg',   price:200,  unit:'piece',  emoji:'🐟' },
  { category:'drinks',    name:'Pure Water (sachet)',      price:20,   unit:'sachet', emoji:'💧' },
  { category:'drinks',    name:'Bottled Water (50cl)',     price:150,  unit:'bottle', emoji:'🍶' },
  { category:'drinks',    name:'Zobo (cup)',               price:100,  unit:'cup',    emoji:'🥤' },
  { category:'drinks',    name:'Soft Drink (35cl can)',    price:300,  unit:'can',    emoji:'🥤' },
  { category:'drinks',    name:'Kunu (cup)',               price:100,  unit:'cup',    emoji:'🥛' },
  { category:'drinks',    name:'Chapman / Juice (bottle)', price:400,  unit:'bottle', emoji:'🧃' },
];

async function withDB(fn){ await connectDB(); return fn(); }

async function getProfile(){
  return withDB(()=>Profile.findOne().sort({createdAt:-1}).lean());
}
async function saveProfile(data){
  await connectDB();
  const ex=await Profile.findOne().sort({createdAt:-1});
  if(ex){Object.assign(ex,data);await ex.save();return ex.toObject();}
  const doc=await Profile.create(data);return doc.toObject();
}
async function getTransactions(month){
  return withDB(()=>{
    const q=month?{month}:{};
    return Transaction.find(q).sort({createdAt:-1}).lean();
  });
}
async function addTransaction(txn){
  await connectDB();
  const doc=await Transaction.create(txn);return doc.toObject();
}
async function updateTransaction(id,updates){
  await connectDB();
  const doc=await Transaction.findByIdAndUpdate(id,updates,{new:true});
  return doc?doc.toObject():null;
}
async function deleteTransaction(id){
  await connectDB();
  return !!(await Transaction.findByIdAndDelete(id));
}
async function getBudget(month){
  await connectDB();
  return(await Budget.findOne({month}).lean())||{total:0,cats:{}};
}
async function saveBudget(month,data){
  await connectDB();
  const doc=await Budget.findOneAndUpdate({month},{total:data.total,cats:data.cats||{}},{upsert:true,new:true});
  return doc.toObject();
}
async function getFoodPrices(){
  await connectDB();
  const count=await FoodPrice.countDocuments();
  if(count===0) await FoodPrice.insertMany(DEFAULT_FOOD_PRICES);
  return FoodPrice.find().sort({category:1,price:1}).lean();
}
async function saveFoodPrices(prices){
  await connectDB();
  await FoodPrice.deleteMany({});
  const docs=await FoodPrice.insertMany(prices);
  return docs.map(d=>d.toObject());
}
async function addFoodItem(item){
  await connectDB();
  return(await FoodPrice.create(item)).toObject();
}
async function updateFoodItem(id,updates){
  await connectDB();
  const doc=await FoodPrice.findByIdAndUpdate(id,updates,{new:true});
  return doc?doc.toObject():null;
}
async function deleteFoodItem(id){
  await connectDB();
  return !!(await FoodPrice.findByIdAndDelete(id));
}
async function resetFoodPrices(){
  await connectDB();
  await FoodPrice.deleteMany({});
  const docs=await FoodPrice.insertMany(DEFAULT_FOOD_PRICES);
  return docs.map(d=>d.toObject());
}
async function getMonthStats(month){
  await connectDB();
  const txns=await getTransactions(month);
  const income=txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expenses=txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const budget=await getBudget(month);
  const catTotals={};
  txns.filter(t=>t.type==='expense').forEach(t=>{catTotals[t.category]=(catTotals[t.category]||0)+t.amount;});
  return{income,expenses,balance:income-expenses,budget,catTotals,txnCount:txns.length};
}

module.exports={
  getProfile,saveProfile,
  getTransactions,addTransaction,updateTransaction,deleteTransaction,
  getBudget,saveBudget,
  getFoodPrices,saveFoodPrices,addFoodItem,updateFoodItem,deleteFoodItem,resetFoodPrices,
  getMonthStats,DEFAULT_FOOD_PRICES,
};
