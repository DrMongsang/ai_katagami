#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Excel データを JSON 形式に変換するスクリプト
お直し_仕上がり寸含む_分析用_2025年9月.xlsx → belly_data.json
"""

import pandas as pd
import json
from datetime import datetime
import sys

def load_repair_data(file_path):
    """DB_お直しシートを読み込む"""
    print("📊 DB_お直しシートを読み込み中...")
    df = pd.read_excel(file_path, sheet_name='DB_お直し', header=1)
    print(f"✓ {len(df)} レコードを読み込みました")
    return df

def load_body_type_analysis(file_path):
    """体型別傾向分析シートを読み込む"""
    print("📊 体型別傾向分析シートを読み込み中...")
    df = pd.read_excel(file_path, sheet_name='体型別傾向分析', header=0)
    print(f"✓ {len(df)} レコードを読み込みました")
    return df

def convert_to_json_serializable(obj):
    """Pandas/NumPyオブジェクトをJSON互換に変換"""
    if pd.isna(obj):
        return None
    if isinstance(obj, (pd.Timestamp, datetime)):
        return obj.strftime('%Y-%m-%d')
    if isinstance(obj, (int, float)):
        if pd.isna(obj):
            return None
        return float(obj) if isinstance(obj, float) else int(obj)
    return str(obj)

def create_json_data(df_repair, df_analysis):
    """JSON形式のデータを作成"""
    print("🔄 JSONデータを作成中...")

    # メタデータ
    metadata = {
        "total_records": int(len(df_repair)),
        "unique_customers": int(df_repair['member_id'].nunique()),
        "date_range": {
            "start": df_repair['order_date'].min().strftime('%Y-%m-%d'),
            "end": df_repair['order_date'].max().strftime('%Y-%m-%d')
        },
        "stores": int(df_repair['採寸店舗'].nunique()),
        "staff": int(df_repair['採寸者'].nunique()),
        "generated_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    # レコードデータ（主要列のみ抽出）
    records = []
    for _, row in df_repair.iterrows():
        record = {
            "order_id": convert_to_json_serializable(row.get('order_id')),
            "member_id": convert_to_json_serializable(row.get('member_id')),
            "order_date": convert_to_json_serializable(row.get('order_date')),
            "ship_date": convert_to_json_serializable(row.get('ship_date')),
            "repair_date": convert_to_json_serializable(row.get('repair_date')),
            "store": convert_to_json_serializable(row.get('採寸店舗')),
            "staff": convert_to_json_serializable(row.get('採寸者')),
            "repair_class": convert_to_json_serializable(row.get('お直し分類')),
            "order_kbn": convert_to_json_serializable(row.get('order_kbn')),
            "category_name": convert_to_json_serializable(row.get('category_name')),
            "item_name": convert_to_json_serializable(row.get('item_name'))
        }
        records.append(record)

    # 店舗一覧
    stores = []
    for store_name, count in df_repair['採寸店舗'].value_counts().items():
        stores.append({
            "name": str(store_name),
            "count": int(count)
        })

    # 担当者一覧
    staff = []
    for staff_name, count in df_repair['採寸者'].value_counts().items():
        staff.append({
            "name": str(staff_name),
            "count": int(count)
        })

    # お直し分類の分布
    repair_class_dist = {}
    for class_name, count in df_repair['お直し分類'].value_counts().items():
        repair_class_dist[str(class_name)] = int(count)

    # 体型区分の分布（体型別傾向分析シートから）
    body_type_dist = {}
    height_dist = {}

    # 体型区分の抽出
    body_type_rows = df_analysis[df_analysis['身長区分'] == 'ALL']
    for _, row in body_type_rows.iterrows():
        if pd.notna(row['体型区分']) and row['体型区分'] != 'ALL':
            body_type_dist[str(row['体型区分'])] = {
                "count": int(row['全体件数']),
                "ratio": float(row['全体比率'])
            }

    # 身長区分の抽出
    height_rows = df_analysis[df_analysis['体型区分'] == 'ALL']
    for _, row in height_rows.iterrows():
        if pd.notna(row['身長区分']) and row['身長区分'] != 'ALL':
            height_dist[str(row['身長区分'])] = {
                "count": int(row['全体件数']),
                "ratio": float(row['全体比率'])
            }

    # JSONデータ構造
    json_data = {
        "metadata": metadata,
        "records": records,
        "stores": stores,
        "staff": staff,
        "distributions": {
            "repair_class": repair_class_dist,
            "body_type": body_type_dist,
            "height": height_dist
        }
    }

    print(f"✓ JSONデータを作成しました")
    return json_data

def main():
    """メイン処理"""
    input_file = "お直し_仕上がり寸含む_分析用_2025年9月.xlsx"
    output_file = "belly_data.json"

    print("=" * 60)
    print("  Excel → JSON 変換スクリプト")
    print("=" * 60)

    try:
        # データ読み込み
        df_repair = load_repair_data(input_file)
        df_analysis = load_body_type_analysis(input_file)

        # JSON作成
        json_data = create_json_data(df_repair, df_analysis)

        # ファイル出力
        print(f"💾 {output_file} に保存中...")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)

        print(f"✓ 保存完了: {output_file}")

        # サマリー表示
        print("\n" + "=" * 60)
        print("  変換サマリー")
        print("=" * 60)
        print(f"総レコード数: {json_data['metadata']['total_records']:,}")
        print(f"ユニーク顧客数: {json_data['metadata']['unique_customers']:,}")
        print(f"期間: {json_data['metadata']['date_range']['start']} 〜 {json_data['metadata']['date_range']['end']}")
        print(f"店舗数: {json_data['metadata']['stores']}")
        print(f"担当者数: {json_data['metadata']['staff']}")
        print("\n体型区分:")
        for body_type, data in json_data['distributions']['body_type'].items():
            print(f"  {body_type}: {data['count']:,}件 ({data['ratio']*100:.1f}%)")
        print("\n身長区分:")
        for height, data in json_data['distributions']['height'].items():
            print(f"  {height}: {data['count']:,}件 ({data['ratio']*100:.1f}%)")
        print("=" * 60)
        print("✅ 変換完了！")

    except FileNotFoundError:
        print(f"❌ エラー: {input_file} が見つかりません")
        sys.exit(1)
    except Exception as e:
        print(f"❌ エラーが発生しました: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
