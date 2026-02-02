"use client";

import PropertyMapEmbed from "./PropertyMapEmbed";

interface PropertyDetailsProps {
  property: {
    id: string;
    url: string;
    source: string | null;
    title: string | null;
    price: number | null;
    price_per_sqm: number | null;
    address: string | null;
    location: string | null;
    floor_plan: string | null;
    year_built: number | null;
    year_built_month: number | null;
    building_area: number | null;
    land_area: number | null;
    building_floors: string | null;
    floor_number: string | null;
    access: string | null;
    building_structure: string | null;
    road_access: string | null;
    floor_area_ratio: number | null;
    building_coverage_ratio: number | null;
    land_category: string | null;
    zoning: string | null;
    urban_planning: string | null;
    land_rights: string | null;
    transportation: Array<{ line: string; station: string; walk: string }> | null;
    yield_rate: number | null;
  };
  showBasicInfo?: boolean;
  showPropertyDetails?: boolean;
  showTransportation?: boolean;
  showLandInfo?: boolean;
  /** 認証中・リダイレクト等で物件データが取れなかった場合 true */
  propertyDataUnavailable?: boolean;
}

export default function PropertyDetails({ 
  property,
  showBasicInfo = true,
  showPropertyDetails = true,
  showTransportation = true,
  showLandInfo = true,
  propertyDataUnavailable = false,
}: PropertyDetailsProps) {
  if (propertyDataUnavailable) {
    return (
      <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50 shadow-sm">
        <div className="border-b border-amber-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-amber-900">物件情報</h3>
        </div>
        <div className="px-6 py-6 space-y-3">
          <p className="text-amber-800 font-medium">物件データが取得できていません</p>
          <p className="text-sm text-amber-700">
            サイトの認証ページやリダイレクトにより、物件の詳細データを取得できませんでした。同じURLは他の方の結果を使い回します。
          </p>
          {property.url && (
            <a
              href={property.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
            >
              {property.url}
            </a>
          )}
        </div>
      </div>
    );
  }

  const formatNumber = (num: number | null) => {
    if (num === null) return "-";
    return num.toLocaleString();
  };

  const TableRow = ({ label, value, colSpan = 1 }: { label: string; value: React.ReactNode; colSpan?: number }) => (
    <tr className="border-b border-gray-100 transition-colors hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50/50 w-1/3">
        {label}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900" colSpan={colSpan}>
        {value}
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      {/* 基本情報 */}
      {showBasicInfo && (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100/50 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">基本情報</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              <TableRow
                label="URL"
                value={
                  <a
                    href={property.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 hover:underline break-all font-medium"
                  >
                    {property.url}
                  </a>
                }
                colSpan={1}
              />
              <TableRow
                label="データソース"
                value={
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {property.source || "不明"}
                  </span>
                }
              />
              {property.title && (
                <TableRow
                  label="物件名"
                  value={<span className="font-medium">{property.title}</span>}
                  colSpan={1}
                />
              )}
              <TableRow
                label="価格"
                value={
                  property.price ? (
                    <span className="text-lg font-bold text-gray-900">
                      {formatNumber(property.price)}
                      <span className="text-sm font-normal text-gray-600 ml-1">円</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )
                }
              />
              <TableRow
                label="平米単価"
                value={
                  property.price_per_sqm ? (
                    <span className="font-medium text-gray-900">
                      {formatNumber(property.price_per_sqm)}
                      <span className="text-gray-600 ml-1">円/㎡</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )
                }
              />
              <TableRow
                label="所在地"
                value={
                  (() => {
                    const addr = property.address || property.location;
                    if (!addr) return <span className="text-gray-400">-</span>;
                    // 「地図で見る」などの余分なテキストを削除
                    const cleanAddr = addr.replace(/\s*地図で見る\s*/g, "").trim();
                    return <span>{cleanAddr}</span>;
                  })()
                }
                colSpan={1}
              />
            </tbody>
          </table>
        </div>
        {(property.address || property.location) && (
          <div className="px-4 pb-4">
            <PropertyMapEmbed address={property.address || property.location || ""} />
          </div>
        )}
      </div>
      )}

      {/* 物件詳細 */}
      {showPropertyDetails && (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100/50 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">物件詳細</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              <TableRow
                label="間取り"
                value={
                  property.floor_plan ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-indigo-100 text-indigo-800">
                      {property.floor_plan}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )
                }
              />
              <TableRow
                label="築年月"
                value={
                  property.year_built !== null ? (
                    <span className="text-gray-900">
                      {property.year_built >= 1900
                        ? property.year_built
                        : new Date().getFullYear() - property.year_built}
                      年
                      {property.year_built_month != null ? `${property.year_built_month}月` : ""}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )
                }
              />
              <TableRow
                label="建物面積"
                value={
                  property.building_area ? (
                    <span className="font-medium text-gray-900">
                      {formatNumber(property.building_area)}
                      <span className="text-gray-600 ml-1">㎡</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )
                }
              />
              <TableRow
                label="土地面積"
                value={
                  property.land_area ? (
                    <span className="font-medium text-gray-900">
                      {formatNumber(property.land_area)}
                      <span className="text-gray-600 ml-1">㎡</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )
                }
              />
              <TableRow
                label="階建/階"
                value={
                  property.building_floors || property.floor_number ? (
                    <span className="text-gray-900">
                      {property.building_floors || ""}
                      {property.floor_number && ` / ${property.floor_number}`}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )
                }
              />
              <TableRow
                label="建物構造"
                value={property.building_structure || <span className="text-gray-400">-</span>}
              />
              {property.yield_rate && (
                <TableRow
                  label="利回り"
                  value={
                    <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-semibold bg-green-100 text-green-800">
                      {property.yield_rate}%
                    </span>
                  }
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* 交通・アクセス */}
      {showTransportation && (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100/50 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">交通</h3>
        </div>
        {property.transportation && property.transportation.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    路線
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    駅名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    徒歩時間
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {property.transportation.map((t, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-100 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{t.line}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{t.station}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        徒歩{t.walk}分
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : property.access ? (
          <div className="px-6 py-4">
            <p className="text-sm text-gray-600">{property.access}</p>
          </div>
        ) : (
          <div className="px-6 py-4">
            <p className="text-sm text-gray-400">-</p>
          </div>
        )}
      </div>
      )}

      {/* 土地・法規制情報 */}
      {showLandInfo && (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100/50 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">土地・法規制情報</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              <TableRow
                label="接道状況"
                value={property.road_access || <span className="text-gray-400">-</span>}
              />
              <TableRow
                label="容積率"
                value={
                  property.floor_area_ratio ? (
                    <span className="font-medium text-gray-900">
                      {property.floor_area_ratio}
                      <span className="text-gray-600 ml-1">%</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )
                }
              />
              <TableRow
                label="建ぺい率"
                value={
                  property.building_coverage_ratio ? (
                    <span className="font-medium text-gray-900">
                      {property.building_coverage_ratio}
                      <span className="text-gray-600 ml-1">%</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )
                }
              />
              <TableRow
                label="地目"
                value={property.land_category || <span className="text-gray-400">-</span>}
              />
              <TableRow
                label="都市計画"
                value={property.urban_planning || <span className="text-gray-400">-</span>}
              />
              <TableRow
                label="土地権利"
                value={property.land_rights || <span className="text-gray-400">-</span>}
              />
              <TableRow
                label="用途地域"
                value={
                  property.zoning ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {property.zoning}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )
                }
              />
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
