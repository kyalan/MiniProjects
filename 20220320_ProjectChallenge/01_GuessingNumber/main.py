from random import randrange

ans = randrange(10)

print('Welcome to Guessing Number game !')
lb, ub = 0, 9
while True:
    guess = input(f'Please guess an integer between {lb} - {ub}:\n')
    try:
        int_guess = int(guess)
        if not((lb <= int_guess) & (int_guess <= ub)):
            raise ValueError
        if int_guess < ans:
            print('Incorrect but near the answer !')
            lb = int_guess
        elif int_guess > ans:
            print('Incorrect but near the answer !')
            ub = int_guess
        elif int_guess == ans:
            print('Awesome ! you guess correctly !!!')
            break
    except ValueError:
        print('Wrong Input! Please guess again!')

print('Thanks for playing !')