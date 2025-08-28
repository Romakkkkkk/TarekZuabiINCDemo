// Formal JS models derived from your Java class structure
class Vehicle {
  constructor({ id, name, type, fuel, pricePerDayRent, priceBuy, imageUrl }) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.fuel = fuel;
    this.pricePerDayRent = Number(pricePerDayRent);
    this.priceBuy = Number(priceBuy);
    this.imageUrl = imageUrl; // may be null; UI shows placeholder box
  }
  estimateRent(days = 1, qty = 1) { return this.pricePerDayRent * Math.max(1, days) * Math.max(1, qty); }
  estimateBuy(qty = 1) { return this.priceBuy * Math.max(1, qty); }
}
class Car extends Vehicle { constructor(opts) { super(opts); this.type = "car"; } }
class Truck extends Vehicle { constructor(opts) { super(opts); this.type = "truck"; } }
class GasolineCars extends Car { constructor(opts) { super({ ...opts, fuel: "gasoline" }); } }
class ElectricCars extends Car { constructor(opts) { super({ ...opts, fuel: "electric" }); } }
class DieselTruck extends Truck { constructor(opts) { super({ ...opts, fuel: "diesel" }); } }
class ElectricTrucks extends Truck { constructor(opts) { super({ ...opts, fuel: "electric" }); } }

function vehicleFromRow(row) {
  const base = {
    id: row.id, name: row.name, type: row.type, fuel: row.fuel,
    pricePerDayRent: row.price_per_day_rent, priceBuy: row.price_buy, imageUrl: row.image_url,
  };
  if (row.type === "car" && row.fuel === "electric") return new ElectricCars(base);
  if (row.type === "car" && row.fuel === "gasoline") return new GasolineCars(base);
  if (row.type === "truck" && row.fuel === "diesel") return new DieselTruck(base);
  if (row.type === "truck" && row.fuel === "electric") return new ElectricTrucks(base);
  return new Vehicle(base);
}

export { Vehicle, Car, Truck, GasolineCars, ElectricCars, DieselTruck, ElectricTrucks, vehicleFromRow };
