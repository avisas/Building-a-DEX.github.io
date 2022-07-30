// connect to Moralis server
const serverUrl = "https://cdtho8hsnhxh.usemoralis.com:2053/server";
const appId = ("0eVLcWkKFtiJ44OatJO3pcTA9JUsBlQNpSliElSK");
Moralis.start({ serverUrl, appId });

//Initialize the pluggin to buy Crypto
Moralis
    .initPlugins()
    .then(() => console.log('Pluggins have been initialized'));

const $tokenBalanceTbody = document.querySelector('.js-token-balances');
const $selectedToken = document.querySelector('.js-from-token');

// Login - Logout and initialization
async function login() {
    let user = Moralis.User.current();
    if (!user) {
        user = await Moralis.authenticate();
    }
    console.log("logged in user:", user);
    getStats();
}

async function initSwapForm(event) {
    event.preventDefault();
    $selectedToken.innerText = event.target.dataset.symbol;
    $selectedToken.dataset.address = event.target.dataset.address;
    $selectedToken.dataset.decimals = event.target.dataset.decimals;
    $selectedToken.dataset.max = event.target.dataset.max;
    $amountInput.removeAttribute('disabled');
    $amountInput.value = '';
    document.querySelector('.js-submit').removeAttribute('disabled');
    document.querySelector('.js-cancel').removeAttribute('disabled');
    document.querySelector('.js-quote-container').innerHTML = '';
}


async function getStats() {
    //Retrieve all token balances of a current user or specified address. 
    //Returns an object with the number of tokens and the array of token objects (asynchronous).
    const balances = await Moralis.Web3API.account.getTokenBalances({ chain: 'polygon' });
    console.log(balances);
    $tokenBalanceTbody.innerHTML = balances.map((token, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${token.symbol}</td>
            <td>${tokenValue(token.balance, token.decimals)}</td>
            <td>
                <button class="js-swap" 
                data-address="${token.token_address}" 
                data-symbol="${token.symbol}"
                data-secimals="${token.decimals}"
                data-max="${tokenValue(token.balance, token.decimals)}"
                >
                Swap
                </button>
            </td>
        </tr>
    `).join('');

    for (let $btn of $tokenBalanceTbody.querySelectorAll('.js-swap')) {
        $btn.addEventListener('click', initSwapForm);
    }
}

async function buyCrypto() {
    Moralis.Plugins.fiat.buy();
}

async function logOut() {
    await Moralis.User.logOut();
    console.log("logged out");
}

document.querySelector("#btn-login").addEventListener('click', login);
document.getElementById("btn-buy-crypto").addEventListener('click', buyCrypto);
document.getElementById("btn-logout").addEventListener('click', logOut);

// Quote / swap
async function formSubmitted(event) {
    event.preventDefault();
    const fromAmount = Number.parseFloat($amountInput.value); // compare these two values.
    const fromMaxValue = number.parseFloat($selectedToken.dataset.max); // compare 
    if (Number.isNaN(fromAmount) || fromAmount > fromMaxValue) {
        // invalid message
        document.querySelector('.js-amount-error error').innerText = 'Invalid amount';
        return;
    } else {
        document.querySelector('.js-amount-error error').innerText = '';
    }

    //Submission of the quote request
    const fromDecimals = $selectedToken.dataset.decimals;
    const fromTokenAddress = $selectedToken.dataset.address;

    const [toTokenAddress, toDecimals] = document.querySelector('[name=to-token]').value.split('-');

    try {
        const quote = await Moralis.Plugins.oneInch.quote({
            chain: 'polygon', // The blockchain you want to use (eth/bsc/polygon)
            fromTokenAddress: fromTokenAddress,  // The token you want to swap
            toTokenAddress: toTokenAddress,  // The token you want to receive
            amount: Moralis.Units.Token(fromAmount, fromDecimals).toString(),
        });

        const toAmount = tokenValue(quote.toTokenAmount, toDecimals);
        document.querySelector('.js-quote-container').innerHTML = `
            <p>${fromAmount} ${quote.fromToken.symbol} = ${toAmount} ${quote.toToken.symbol}</p>
            <p>Gas fee: ${quote.estimatedGas}</p>
        `;
        document.querySelector('.js-approve').removeAttribute('disabled');
    } catch (e) {
        document.querySelector('.js-quote-container').innerHTML = `
            <p class="error">The conversion didn't succeed.</p>
        `;
    }
}

document.querySelector('.js-approve').addEventListener('click', swap);

async function swap() {
    const receipt = await Moralis.Plugins.oneInch.swap({
        chain: 'polygon', // The blockchain you want to use (eth/bsc/polygon)
        fromTokenAddress: fromTokenAddress, // The token you want to swap
        toTokenAddress: toTokenAddress, // The token you want to receive
        amount: oralis.Units.Token(fromAmount, fromDecimals).toString(),
        fromAddress: Moralis.User.current().get('ethAddress'), // Your wallet address
        slippage: 1,
    });
    console.log(receipt);
}

async function formCanceled(event) {
    event.preventDefault();
    document.querySelector('.js-submit').setAttribute('disabled', '');
    document.querySelector('.js-cancel').setAttribute('disabled', '');
    $amountInput.value = '';
    $amountInput.setAttribute('disabled', '');
    delete $selectedToken.dataset.address;
    delete $selectedToken.dataset.decimals;
    delete $selectedToken.dataset.max;
    document.querySelector('.js-quote-container').innerHTML = '';
}

document.querySelector('.js-submit').addEventListener('click', formSubmitted);
document.querySelector('.js-cancel').addEventListener('click', formCanceled);

// To token dropdown preparation
async function getTop10Coins() {
    try {
        let coinPaprika = await fetch('https://api.coinpaprika.com/v1/coins');
        let tokens = await coinPaprika.json();
        return tokens
            .filter(token => token.rank >= 1 && token.rank <= 30)
            .map(token => token.symbol);
    } catch (e) {
        console.log(`Error: ${e}`);
    }

}

async function getTickerData(tickerList) {
    const tokens = await Moralis.Plugins.oneInch.getSupportedTokens({
        chain: 'polygon',
    });
    const tokenList = Object.values(tokens.tokens);
    //console.log(tokenList);

    return tokenList.filter(token => tickerList.includes(token.symbol));  // filter token list
}

function renderTokenDropDown(tokens) {
    const options = tokens.map(token =>
        `
        <option value='${token.address}-${token.decimals}'>
            ${token.name}
        </option>
        `).join('');
    document.querySelector('[name=to-token]').innerHTML = options;
}

getTop10Coins()
    .then(tickerList => getTickerData(tickerList))
    .then(renderTokenDropDown);