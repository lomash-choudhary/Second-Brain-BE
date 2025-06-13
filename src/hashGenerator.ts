export const hashGenerator = (len: number) => {
    let option = "qwertyuiopasdfghjklzxcvbnm1234567890"
    let ans = ""
    let lengthOfOption = option.length;
    for(let i = 0; i < len; i++){
        ans += option[Math.floor(Math.random() * lengthOfOption)]
    }
    return ans
}