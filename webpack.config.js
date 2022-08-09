const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");

module.exports = {
    entry: {
        main: path.resolve(__dirname, './src/app.ts'),
    },
    output: {
        filename: "[name].js",
        path: path.resolve(__dirname, 'out'),
        clean: true
    },
    devServer: {
        static: './out',
        open: true,
        hot: true
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: "./src/index.html",
            filename: "index.html"
        }),
    ],
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            },
            {
                test: /\.(?:ico|gif|png|jpg|jpeg)$/i,
                type: "asset/resource"
            },
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /nodes_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    }
};