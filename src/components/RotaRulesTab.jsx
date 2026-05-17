export default function RotaRulesTab() {
  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Annual Leave Rules</h2>
      <ul className="list-disc list-outside pl-5 text-gray-700 text-sm space-y-3 mb-10">
        <li>All leave must be requested at least 6 weeks in advance. If requested less than 6 weeks in advance then email the rota coordinator.</li>
        <li>No leave will be granted (study or annual) on nights or weekends</li>
        <li>
          Bank holidays are added to everyone's leave allocation as the rolling rota means
          your shift either falls on the day itself, or the bank holiday falls on a zero day
          — this means everyone gets all this time in lieu
        </li>
        <li>There can be a maximum of 6 people taking annual leave per day, depending on the shift. Leave will be granted on a first-come, first-served basis</li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mb-4">Swap Rules</h2>
      <ul className="list-disc list-outside pl-5 text-gray-700 text-sm space-y-3">
        <li>
          You are allowed to swap any shifts you like as long as you both agree and the swap
          does not create unsafe fatigue
        </li>
        <li>
          Swaps will not be approved with fewer than 11 hours between shifts, fewer than
          48 hours post-nights, or more than 7 consecutive days of shifts, as these break
          the requirements of the 2016 contract
        </li>
        <li>Night shifts can only be swapped with other night shifts</li>
        <li>
          Email all rota swaps or rota queries to{' '}
          <a
            href="mailto:imperial.smhed-shorota@nhs.net"
            className="text-pink-500 underline"
          >
            imperial.smhed-shorota@nhs.net
          </a>
        </li>
      </ul>
    </div>
  )
}
