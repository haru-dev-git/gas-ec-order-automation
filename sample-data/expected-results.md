# サンプルデータの期待結果

`products.csv` と `orders_raw.csv` を各シートへ取り込んだ場合の期待結果です。CSV末尾の完全な空行は処理対象外です。

| 分類 | 件数 | 対象 |
| --- | ---: | --- |
| orders_valid | 2 | ORD-1001, ORD-1002 |
| orders_error | 13 | ORD-1003相当のorder_id欠損行からORD-1015の重複2行まで |
| total_count | 15 | 完全な空行を除くorders_rawの注文行 |

主な確認ケースは次のとおりです。

- `ORD-1005` は必須項目、quantity、unit_price、emailの複数エラーを1行にまとめます。
- `ORD-1012` はproductsにない商品コード、`ORD-1013` は販売停止商品、`ORD-1014` は商品マスタとの価格不一致です。
- `ORD-1015` の2行はどちらも重複エラーです。
- `processOrders()`を再実行しても、出力行は追記されず今回の2件・13件に置き換わります。

成功時は、`execution_logs`へ`SUCCESS`の1行が追加されます。行にはrun_id、実行日時、`total_count = 15`、`valid_count = 2`、`error_count = 13`が入ります。実行ユーザーのメールアドレスを取得でき、Gmail権限が承認されている場合は、個人情報を含まない集計結果メールも1通送信されます。
