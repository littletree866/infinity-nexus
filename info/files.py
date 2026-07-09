
class Game():
    
    def __init__(self):
        self.money = 0
        self.stocks = {
            "apple": {
                "amount": 1,
                "price" : 1
            }
        }

    def addmoney(self):
        self.money += 1
        print("You stole $1")
    
    def buystuff(self):
        for s in self.stocks:
            print(s)

        buy = input("What do you want? ").lower()

        if buy in self.stocks:
            item = self.stocks[buy]

            if self.money >= item["price"]:
                self.money -= item["price"]
                item["amount"] -= 1
                print("Bought", buy)
            else:
                print("You're too broke to buy that")
        else:
            print("That doesn't exist")


    def main(self):
        while True:
            print(f"Welcome! Enter a number to begin! \nMoney: ${self.money}")
            print("------------------------------")
            print("1. Gain $1")
            print("2. Buy something")
            print("3. Sell something")
            print("4. Check the stocks")
            print("5. Exit this simulation")
            selection = input("Enter your number: ")
            print("------------------------------")
            if selection == "1":
                self.addmoney()
            if selection == "2":
                self.buystuff()
            if selection == "3":
                print("This feature has not been added yet")
            if selection == "4":
                print("This feature has not been added yet")
            if selection == "5":
                break
            print("------------------------------")


game = Game()
game.main()
